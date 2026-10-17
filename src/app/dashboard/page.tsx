import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCustomerJobs } from "@/lib/jobs";
import { myBookings } from "@/lib/bookings";
import { myBids } from "@/lib/bids";
import { reputationFor } from "@/lib/reputation";
import { revealedReviewsFor } from "@/lib/reviews";
import { dt, pkr, statusLabel } from "@/lib/format";
import { Stars } from "@/components/ui";
import { ActionForm, Submit } from "@/components/ActionForm";
import { withdrawBidAction } from "../actions";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  if (!user.display_name) {
    return <p className="notice">Please <Link href="/account?setup=1">add your name</Link> to continue.</p>;
  }
  const [jobs, bookings, rep, reviews, bids] = await Promise.all([
    listCustomerJobs(user), myBookings(user), reputationFor([user.id]), revealedReviewsFor(user.id),
    user.is_worker ? myBids(user) : Promise.resolve([]),
  ]);
  const me = rep.get(user.id);
  const restricted = user.account_status !== "active";

  return (
    <>
      <h1>Hello, {user.display_name}</h1>
      {restricted && <p className="msg msg-error">Your account is {user.account_status}. See <Link href="/account">Account</Link> to appeal.</p>}

      <section aria-labelledby="my-jobs">
        <div className="row"><h2 id="my-jobs" style={{ marginInlineEnd: "auto" }}>My jobs (as customer)</h2><Link className="btn btn-sm" href="/jobs/new">Post a job</Link></div>
        {jobs.length === 0 ? (
          <div className="card empty"><p>You haven&apos;t posted a job yet.</p><Link className="btn" href="/jobs/new">Post your first job</Link></div>
        ) : jobs.map((j) => (
          <div className="card" key={j.id}>
            <div className="row"><h3 style={{ marginInlineEnd: "auto" }}><Link href={j.status === "draft" ? `/jobs/${j.id}/preview` : `/jobs/${j.id}`}>{j.title}</Link></h3><span className="pill">{statusLabel(j.status)}</span></div>
            <p className="meta">{j.category} · {j.area} · posted {dt(j.created_at)} · {j.bid_count} active bid{j.bid_count === 1 ? "" : "s"}</p>
          </div>
        ))}
      </section>

      {user.is_worker && (
        <section aria-labelledby="my-bids">
          <div className="row"><h2 id="my-bids" style={{ marginInlineEnd: "auto" }}>My bids (as worker)</h2><Link className="btn btn-sm" href="/worker/jobs">Find jobs</Link></div>
          {bids.length === 0 ? <div className="card empty"><p>No bids yet. Browse matching jobs to start.</p></div> : bids.map((b) => (
            <div className="card" key={b.id}>
              <div className="row"><h3 style={{ marginInlineEnd: "auto" }}><Link href={`/jobs/${b.job_id}`}>{b.title}</Link></h3><span className="pill">{statusLabel(b.status)}</span></div>
              <p className="meta">{pkr(b.amount)} · updated {dt(b.updated_at)} · job is {statusLabel(b.job_status).toLowerCase()}</p>
              {b.status === "active" && (
                <ActionForm action={withdrawBidAction}><input type="hidden" name="bidId" value={b.id} /><input type="hidden" name="jobId" value={b.job_id} /><Submit className="btn btn-ghost btn-sm">Withdraw bid</Submit></ActionForm>
              )}
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="bookings">
        <h2 id="bookings">Bookings &amp; history</h2>
        {bookings.length === 0 ? <div className="card empty">No bookings yet. They appear here once a bid is accepted.</div> : bookings.map((b) => (
          <div className="card" key={b.id}>
            <div className="row"><h3 style={{ marginInlineEnd: "auto" }}><Link href={`/jobs/${b.job_id}`}>{b.title}</Link></h3><span className="pill">{statusLabel(b.status)}</span></div>
            <p className="meta">You were the {b.customer_id === user.id ? "customer" : "worker"} · {pkr(b.amount)} · selected {dt(b.selected_at)}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="reviews">
        <h2 id="reviews">Reviews about you</h2>
        <p><Stars avg={me?.rating_avg} count={me?.rating_count ?? 0} /> · {me?.completed_as_customer ?? 0} completed as customer · {me?.completed_as_worker ?? 0} completed as worker</p>
        {reviews.length === 0 ? <p className="meta">No visible reviews yet. A review appears once both sides have reviewed, or after 7 days.</p> : reviews.map((r) => (
          <div className="card" key={r.id}><span className="stars">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span> <span className="meta">by {r.reviewer_name ?? "Former user"} · {dt(r.created_at)}</span>{r.comment && <p>{r.comment}</p>}</div>
        ))}
      </section>
    </>
  );
}
