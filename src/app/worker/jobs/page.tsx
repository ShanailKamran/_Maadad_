import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { browseJobsForWorker } from "@/lib/jobs";
import { pkr, dt, statusLabel, budgetText } from "@/lib/format";
import { DemoPill } from "@/components/ui";

export const metadata: Metadata = { title: "Find Jobs" };

export default async function WorkerJobsPage() {
  const user = await requireUser();

  if (!user.is_worker) {
    return (
      <div className="card">
        <h1>Worker Profile Required</h1>
        <p>To browse matching jobs and submit bids, please set up your worker profile first.</p>
        <Link className="btn" href="/worker/profile">Set up worker profile</Link>
      </div>
    );
  }

  const jobs = await browseJobsForWorker(user);

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, marginInlineEnd: "auto" }}>Open Jobs in Lahore</h1>
        <Link className="btn btn-ghost btn-sm" href="/worker/profile">My worker profile</Link>
      </div>

      <p className="lead">
        Jobs matching your selected categories and Lahore service areas. Only approximate areas are shown.
      </p>

      {jobs.length === 0 ? (
        <div className="card empty">
          <p>No matching open jobs right now.</p>
          <p className="hint">
            Ensure you have &quot;Accepting bids&quot; enabled and that your categories and service areas in your profile cover active areas.
          </p>
          <Link className="btn btn-ghost btn-sm" href="/worker/profile">Edit service areas</Link>
        </div>
      ) : (
        <div className="grid">
          {jobs.map((j) => (
            <div key={j.id} className="card">
              <div className="row">
                <h2 style={{ margin: 0, fontSize: "1.2rem", marginInlineEnd: "auto" }}>
                  <Link href={`/jobs/${j.id}`}>{j.title}</Link>
                </h2>
                {j.my_bid_status && (
                  <span className="pill pill-warn">Bid {j.my_bid_status}</span>
                )}
                {"is_demo" in j && (j as { is_demo?: boolean }).is_demo && <DemoPill />}
              </div>

              <p className="meta" style={{ margin: "4px 0 8px" }}>
                {j.category} · {j.area}, Lahore · {j.asap ? "As soon as possible" : dt(j.preferred_at)}
              </p>

              <p style={{ margin: "8px 0", color: "var(--ink)" }}>
                {j.description.length > 200 ? j.description.slice(0, 200) + "…" : j.description}
              </p>

              <div className="row" style={{ marginTop: 12 }}>
                <span className="price" style={{ fontSize: "1.1rem" }}>
                  Budget: {budgetText(j.budget_min, j.budget_max)}
                </span>
                <span className="meta" style={{ marginInlineStart: "auto" }}>
                  {j.bid_count} active bid{j.bid_count === 1 ? "" : "s"} · Posted {dt(j.created_at)}
                </span>
              </div>

              <div style={{ marginTop: 12 }}>
                <Link className="btn btn-sm" href={`/jobs/${j.id}`}>
                  {j.my_bid_status ? "View / Edit my bid" : "View details & Bid"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
