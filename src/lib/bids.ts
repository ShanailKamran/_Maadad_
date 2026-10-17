import { q, one, tx, isPostgresAvailable } from "./db";
import { SessionUser } from "./auth";
import { AppError, assertTransition, JobStatus } from "./state";
import { bidSchema, parseOrThrow } from "./validation";
import { rateLimit } from "./ratelimit";
import { getEligibleJob, logStatus } from "./jobs";
import { notify } from "./notify";
import { reputationFor, Reputation } from "./reputation";
import { audit } from "./audit";
import { createHmac } from "crypto";
import { sessionSecret } from "./config";
import { store } from "./store";

export type BidInput = ReturnType<typeof parseBid>;
const parseBid = (form: FormData) =>
  parseOrThrow(bidSchema, Object.fromEntries(["amount", "timingText", "message", "inclusions", "exclusions"].map((k) => [k, form.get(k) ?? undefined])));

/** Create or update this worker's live bid. Requires eligibility (server-side) and an open job. */
export async function submitBid(user: SessionUser, jobId: string, form: FormData): Promise<void> {
  await rateLimit(`bid:${user.id}`, 30, 3600);
  const v = parseBid(form);

  if (!(await isPostgresAvailable())) {
    const job = await getEligibleJob(user, jobId);
    if (!job) throw new AppError("This job isn't available for you to bid on.", "not_found");
    store.submitBid(user.id, jobId, v);
    return;
  }

  const wp = await one<{ accepting_bids: boolean }>("SELECT accepting_bids FROM worker_profiles WHERE user_id=$1", [user.id]);
  if (!wp) throw new AppError("Create a worker profile first.", "forbidden");
  if (!wp.accepting_bids) throw new AppError("Turn on 'accepting bids' in your profile to bid.");
  const job = await getEligibleJob(user, jobId);
  if (!job) throw new AppError("This job isn't available for you to bid on.", "not_found");

  const customerId = await tx(async (c) => {
    // Lock the job row so a concurrent award can't race with this bid.
    const j = await one<{ status: JobStatus; customer_id: string }>("SELECT status, customer_id FROM jobs WHERE id=$1 FOR UPDATE", [jobId], c);
    if (!j || j.status !== "open") throw new AppError("This job is no longer open for bids.");
    const existing = await one<{ id: string }>("SELECT id FROM bids WHERE job_id=$1 AND worker_id=$2 AND status='active'", [jobId, user.id], c);
    if (existing) {
      await q(`UPDATE bids SET amount=$2, timing_text=$3, message=$4, inclusions=$5, exclusions=$6, updated_at=now() WHERE id=$1`,
        [existing.id, v.amount, v.timingText, v.message, v.inclusions, v.exclusions], c);
      await audit(user.id, "bid.updated", "bid", existing.id, {}, c);
      return null;
    }
    const b = await one<{ id: string }>(
      `INSERT INTO bids (job_id, worker_id, amount, timing_text, message, inclusions, exclusions) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [jobId, user.id, v.amount, v.timingText, v.message, v.inclusions, v.exclusions], c);
    await audit(user.id, "bid.created", "bid", b!.id, {}, c);
    return j.customer_id;
  });
  if (customerId)
    await notify(customerId, "new_bid", "New bid on your job", `A worker bid Rs ${v.amount.toLocaleString("en-PK")} on "${job.title}".`, { type: "job", id: jobId });
}

export async function withdrawBid(user: SessionUser, bidId: string): Promise<void> {
  if (!(await isPostgresAvailable())) {
    store.withdrawBid(user.id, bidId);
    return;
  }
  const r = await one<{ id: string }>(
    `UPDATE bids SET status='withdrawn', updated_at=now() WHERE id=$1 AND worker_id=$2 AND status='active' RETURNING id`, [bidId, user.id]);
  if (!r) throw new AppError("That bid can't be withdrawn (it may already be accepted).");
  await audit(user.id, "bid.withdrawn", "bid", bidId);
}

export type BidCard = {
  id: string; worker_id: string; amount: number; timing_text: string; message: string; inclusions: string; exclusions: string;
  status: string; created_at: Date; updated_at: Date; worker_name: string | null; bio: string; experience_years: number | null;
  identity_status: string; rep: Reputation | undefined; categories: string[];
};

/** Customer-only: every bid on one of THEIR jobs, with reputation, for side-by-side comparison. */
export async function listBidsForCustomer(user: SessionUser, jobId: string): Promise<BidCard[]> {
  if (!(await isPostgresAvailable())) {
    return store.listBidsForCustomer(user.id, jobId);
  }
  const own = await one("SELECT 1 FROM jobs WHERE id=$1 AND customer_id=$2", [jobId, user.id]);
  if (!own) throw new AppError("Job not found.", "not_found");
  const rows = await q<Omit<BidCard, "rep">>(
    `SELECT b.id, b.worker_id, b.amount, b.timing_text, b.message, b.inclusions, b.exclusions, b.status, b.created_at, b.updated_at,
            u.display_name AS worker_name, wp.bio, wp.experience_years, wp.identity_status::text AS identity_status,
            COALESCE((SELECT array_agg(c.name) FROM worker_categories wc JOIN service_categories c ON c.id=wc.category_id WHERE wc.user_id=u.id),'{}') AS categories
     FROM bids b JOIN users u ON u.id=b.worker_id JOIN worker_profiles wp ON wp.user_id=u.id
     WHERE b.job_id=$1 AND b.status IN ('active','accepted') AND b.hidden_at IS NULL AND u.account_status='active'
     ORDER BY b.created_at`, [jobId]);
  const rep = await reputationFor(rows.map((r) => r.worker_id));
  return rows.map((r) => ({ ...r, rep: rep.get(r.worker_id) }));
}

export async function myBids(user: SessionUser) {
  if (!(await isPostgresAvailable())) {
    return store.myBids(user.id);
  }
  return q<{ id: string; job_id: string; title: string; amount: number; status: string; job_status: string; updated_at: Date }>(
    `SELECT b.id, b.job_id, j.title, b.amount, b.status::text, j.status::text AS job_status, b.updated_at
     FROM bids b JOIN jobs j ON j.id=b.job_id WHERE b.worker_id=$1 ORDER BY b.updated_at DESC LIMIT 100`, [user.id]);
}

/**
 * Optional 4-digit completion code, derived from the job id + server secret. The customer can view
 * it on their booking page and read it to the worker; entering it records the customer's
 * acknowledgement. It records status only. It is NOT payment protection.
 */
export function completionCode(jobId: string): string {
  const h = createHmac("sha256", sessionSecret()).update(`completion:${jobId}`).digest();
  return String(h.readUInt32BE(0) % 10000).padStart(4, "0");
}

/** Customer accepts exactly one bid. Atomic: award, reject others, create booking, notify. */
export async function acceptBid(user: SessionUser, bidId: string): Promise<{ bookingId: string }> {
  if (!(await isPostgresAvailable())) {
    return store.acceptBid(user.id, bidId);
  }
  return tx(async (c) => {
    const b = await one<{ job_id: string; worker_id: string; status: string }>("SELECT job_id, worker_id, status FROM bids WHERE id=$1", [bidId], c);
    if (!b) throw new AppError("Bid not found.", "not_found");
    const j = await one<{ status: JobStatus; customer_id: string; hidden_at: Date | null; title: string }>(
      "SELECT status, customer_id, hidden_at, title FROM jobs WHERE id=$1 FOR UPDATE", [b.job_id], c);
    if (!j || j.customer_id !== user.id) throw new AppError("Bid not found.", "not_found"); // IDOR-safe
    if (j.hidden_at) throw new AppError("This job is under review and can't be awarded.");
    assertTransition(j.status, "awarded", "customer");
    if (b.status !== "active") throw new AppError("That bid is no longer active.");
    const w = await one<{ account_status: string }>("SELECT account_status FROM users WHERE id=$1", [b.worker_id], c);
    if (w?.account_status !== "active") throw new AppError("That worker's account is currently restricted.");

    await q("UPDATE bids SET status='accepted', updated_at=now() WHERE id=$1", [bidId], c);
    await q("UPDATE bids SET status='rejected', updated_at=now() WHERE job_id=$1 AND status='active' AND id<>$2", [b.job_id, bidId], c);
    await q("UPDATE jobs SET status='awarded', updated_at=now() WHERE id=$1", [b.job_id], c);
    const bk = await one<{ id: string }>(
      `INSERT INTO bookings (job_id, customer_id, worker_id, accepted_bid_id) VALUES ($1,$2,$3,$4) RETURNING id`,
      [b.job_id, user.id, b.worker_id, bidId], c);
    await logStatus(c, b.job_id, "open", "awarded", user.id);
    await audit(user.id, "bid.accepted", "bid", bidId, {}, c);

    const others = await q<{ worker_id: string }>("SELECT worker_id FROM bids WHERE job_id=$1 AND status='rejected' AND id<>$2", [b.job_id, bidId], c);
    for (const o of others)
      await notify(o.worker_id, "bid_rejected", "Customer chose another bid", `The customer chose a different worker for "${j.title}".`, { type: "job", id: b.job_id }, c);
    await notify(b.worker_id, "bid_accepted", "Your bid was accepted", `Open the job to see the address and contact details for "${j.title}".`, { type: "job", id: b.job_id }, c);
    return { bookingId: bk!.id };
  });
}
