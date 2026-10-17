import { timingSafeEqual } from "crypto";
import { q, one, tx, Db, isPostgresAvailable } from "./db";
import { SessionUser } from "./auth";
import { AppError, assertTransition, Actor, JobStatus } from "./state";
import { logStatus } from "./jobs";
import { completionCode } from "./bids";
import { notify } from "./notify";
import { audit } from "./audit";
import { rateLimit } from "./ratelimit";
import { store } from "./store";

export type Booking = {
  id: string; job_id: string; customer_id: string; worker_id: string; status: JobStatus; amount: number;
  selected_at: Date; started_at: Date | null; completion_requested_at: Date | null; completed_at: Date | null;
  title: string; customer_name: string | null; worker_name: string | null; completion_code_attempts: number;
};

const BOOKING_SQL = `
  SELECT b.id, b.job_id, b.customer_id, b.worker_id, b.status, bd.amount, b.selected_at, b.started_at,
         b.completion_requested_at, b.completed_at, j.title, cu.display_name AS customer_name,
         wu.display_name AS worker_name, b.completion_code_attempts
  FROM bookings b JOIN jobs j ON j.id=b.job_id JOIN bids bd ON bd.id=b.accepted_bid_id
  JOIN users cu ON cu.id=b.customer_id JOIN users wu ON wu.id=b.worker_id`;

/** Returns the booking only to its two participants. */
export async function getBookingByJob(user: SessionUser, jobId: string): Promise<Booking | null> {
  if (!(await isPostgresAvailable())) {
    return store.getBookingByJob(user.id, jobId);
  }
  return one<Booking>(`${BOOKING_SQL} WHERE b.job_id=$1 AND (b.customer_id=$2 OR b.worker_id=$2)`, [jobId, user.id]);
}

export async function myBookings(user: SessionUser): Promise<Booking[]> {
  if (!(await isPostgresAvailable())) {
    return store.myBookings(user.id);
  }
  return q<Booking>(`${BOOKING_SQL} WHERE b.customer_id=$1 OR b.worker_id=$1 ORDER BY b.selected_at DESC LIMIT 100`, [user.id]);
}

/** The customer-only completion code for a booking (shown on the customer's page). */
export function codeForCustomer(b: Booking, user: SessionUser): string | null {
  return b.customer_id === user.id && ["awarded", "in_progress", "completion_requested"].includes(b.status)
    ? completionCode(b.job_id) : null;
}

async function move(c: Db, b: { id: string; job_id: string; status: JobStatus }, to: JobStatus, actor: Actor, actorId: string, note?: string) {
  assertTransition(b.status, to, actor);
  const col = to === "in_progress" && b.status === "awarded" ? ", started_at = now()"
    : to === "completion_requested" ? ", completion_requested_at = now()"
    : to === "completed" ? ", completed_at = now()" : "";
  await q(`UPDATE bookings SET status=$2 ${col} WHERE id=$1`, [b.id, to], c);
  await q(`UPDATE jobs SET status=$2, updated_at=now() WHERE id=$1`, [b.job_id, to], c);
  await logStatus(c, b.job_id, b.status, to, actorId, note);
  await audit(actorId, `booking.${to}`, "booking", b.id, {}, c);
}

async function loadParticipant(c: Db, user: SessionUser, bookingId: string) {
  const b = await one<{ id: string; job_id: string; status: JobStatus; customer_id: string; worker_id: string }>(
    `SELECT id, job_id, status, customer_id, worker_id FROM bookings WHERE id=$1 AND (customer_id=$2 OR worker_id=$2) FOR UPDATE`,
    [bookingId, user.id], c);
  if (!b) throw new AppError("Booking not found.", "not_found"); // same error for strangers: no existence leak
  return { b, role: (b.worker_id === user.id ? "worker" : "customer") as "worker" | "customer" };
}

const other = (b: { customer_id: string; worker_id: string }, me: string) => (b.customer_id === me ? b.worker_id : b.customer_id);

export type Action = "start" | "request_completion" | "confirm" | "not_finished" | "cancel";

export async function progress(user: SessionUser, bookingId: string, action: Action, code?: string): Promise<void> {
  await rateLimit(`booking_action:${user.id}`, 60, 3600);

  if (!(await isPostgresAvailable())) {
    store.progressBooking(user.id, bookingId, action, code);
    return;
  }

  await tx(async (c) => {
    const { b, role } = await loadParticipant(c, user, bookingId);
    const nt = (to: string, t: string, body: string) => notify(other(b, user.id), `booking_${to}`, t, body, { type: "job", id: b.job_id }, c);
    switch (action) {
      case "start":
        if (role !== "worker") throw new AppError("Only the selected worker can do this.", "forbidden");
        await move(c, b, "in_progress", "worker", user.id, "arrival/start");
        await nt("started", "Worker has started the job", "The worker marked the job as started.");
        break;
      case "request_completion": {
        if (role !== "worker") throw new AppError("Only the selected worker can do this.", "forbidden");
        await move(c, b, "completion_requested", "worker", user.id);
        const entered = (code ?? "").trim();
        if (entered) {
          const bk = await one<{ completion_code_attempts: number }>("SELECT completion_code_attempts FROM bookings WHERE id=$1", [b.id], c);
          if ((bk?.completion_code_attempts ?? 0) >= 5) throw new AppError("Too many wrong codes. Leave it for the customer to confirm.");
          const a = Buffer.from(entered.padEnd(4, " ")), e = Buffer.from(completionCode(b.job_id));
          if (a.length === e.length && timingSafeEqual(a, e)) {
            // Customer-provided code = recorded customer acknowledgement of completion (status only).
            await move(c, { ...b, status: "completion_requested" }, "completed", "customer", b.customer_id, "acknowledged with completion code");
            await nt("completed", "Job marked completed", "The completion code was entered. You can now leave a review.");
            break;
          }
          throw new AppError("Incorrect completion code.");
        }
        await nt("completion_requested", "Worker says the job is done", "Please confirm completion, or report a problem.");
        break;
      }
      case "confirm":
        if (role !== "customer") throw new AppError("Only the customer can confirm completion.", "forbidden");
        await move(c, b, "completed", "customer", user.id);
        await nt("completed", "Job confirmed complete", "The customer confirmed completion. You can now leave a review.");
        break;
      case "not_finished":
        if (role !== "customer") throw new AppError("Only the customer can do this.", "forbidden");
        await move(c, b, "in_progress", "customer", user.id, "customer marked not finished");
        await nt("not_finished", "Customer says work is not finished", "The customer marked the job as still in progress.");
        break;
      default:
        throw new AppError("Invalid action.");
    }
  });
}

export async function reportProblem(user: SessionUser, bookingId: string, details: string): Promise<void> {
  await rateLimit(`booking_dispute:${user.id}`, 10, 86400);

  if (!(await isPostgresAvailable())) {
    store.reportProblem(user.id, bookingId, details);
    return;
  }

  await tx(async (c) => {
    const { b, role } = await loadParticipant(c, user, bookingId);
    assertTransition(b.status, "disputed", role);
    await move(c, b, "disputed", role, user.id, details);
    await q(`INSERT INTO reports (reporter_id, target_type, target_id, category, details) VALUES ($1,'booking',$2,'dispute',$3)`,
      [user.id, bookingId, details], c);
    await notify(other(b, user.id), "booking_disputed", "Problem reported on booking",
      "A problem was reported. The booking is marked disputed and will be reviewed by a moderator.",
      { type: "job", id: b.job_id }, c);
  });
}
