import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  reportQueue,
  openAppeals,
  identityQueue,
  lowBidJobs,
  moderationHistory,
} from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { dt, statusLabel, pkr } from "@/lib/format";
import { ActionForm, Submit } from "@/components/ActionForm";
import { IdentityBadge } from "@/components/ui";
import {
  moderateAction,
  reportNoteAction,
  appealCloseAction,
  identityDecisionAction,
  settingsAction,
  expandJobAction,
} from "../actions";

export const metadata: Metadata = { title: "Admin & Moderation" };

export default async function AdminDashboard() {
  const admin = await requireAdmin();

  const [reports, appeals, idList, lowBids, settings, history] = await Promise.all([
    reportQueue("open"),
    openAppeals(),
    identityQueue(),
    lowBidJobs(),
    getSettings(),
    moderationHistory(),
  ]);

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, marginInlineEnd: "auto" }}>Admin &amp; Moderation Dashboard</h1>
        <span className="pill">Admin: {admin.display_name || admin.phone}</span>
      </div>

      <p className="lead">
        Role-based moderation tools. Every moderation action requires a reason and is permanently recorded in the audit trail.
      </p>

      {/* Reports Queue */}
      <section aria-labelledby="reports-heading" style={{ marginTop: 24 }}>
        <h2 id="reports-heading">Reports Queue ({reports.length} open)</h2>
        {reports.length === 0 ? (
          <div className="card empty">
            <p>No open reports in the queue.</p>
          </div>
        ) : (
          <div className="grid">
            {reports.map((r) => (
              <div key={r.id} className="card" style={{ borderInlineStart: "4px solid #b3261e" }}>
                <div className="row">
                  <span className="pill pill-warn">{statusLabel(r.category)}</span>
                  <span className="meta" style={{ marginInlineEnd: "auto", marginInlineStart: 8 }}>
                    Target: <strong>{r.target_type}</strong> ({r.target_label || r.target_id.slice(0, 8)})
                  </span>
                  <span className="meta">{dt(r.created_at)}</span>
                </div>

                <p style={{ margin: "8px 0" }}>
                  <strong>Reported by:</strong> {r.reporter_name || "User"}
                </p>
                {r.details && (
                  <p style={{ background: "#fff9f8", padding: 8, borderRadius: 8, margin: "6px 0" }}>
                    &ldquo;{r.details}&rdquo;
                  </p>
                )}

                {r.internal_notes && (
                  <div style={{ background: "#f2f4f3", padding: 8, borderRadius: 8, margin: "6px 0", fontSize: "0.9rem" }}>
                    <strong>Internal notes:</strong>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{r.internal_notes}</pre>
                  </div>
                )}

                {/* Add Internal Note */}
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.9rem" }}>Add internal note</summary>
                  <ActionForm action={reportNoteAction} style={{ marginTop: 6 }}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <div className="field" style={{ margin: 0 }}>
                      <input name="note" type="text" required placeholder="Add note for other moderators..." />
                    </div>
                    <Submit className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}>Add note</Submit>
                  </ActionForm>
                </details>

                {/* Moderation Actions on Report */}
                <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <h4 style={{ margin: "0 0 6px" }}>Take moderation action:</h4>
                  <ActionForm action={moderateAction}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="targetType" value={r.target_type} />
                    <input type="hidden" name="targetId" value={r.target_id} />

                    <div className="grid grid-2" style={{ gap: 8 }}>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor={`act-${r.id}`}>Action</label>
                        <select id={`act-${r.id}`} name="action" required defaultValue="dismiss_report">
                          <option value="dismiss_report">Dismiss report (no violation)</option>
                          {r.target_type === "user" && (
                            <>
                              <option value="warn">Warn user</option>
                              <option value="suspend">Suspend user temporarily</option>
                              <option value="ban">Ban user permanently</option>
                              <option value="reinstate">Reinstate user</option>
                            </>
                          )}
                          {r.target_type === "job" && (
                            <>
                              <option value="hide_job">Hide job post</option>
                              <option value="unhide_job">Unhide job post</option>
                            </>
                          )}
                          {r.target_type === "review" && (
                            <>
                              <option value="hide_review">Hide review</option>
                              <option value="unhide_review">Unhide review</option>
                            </>
                          )}
                          {r.target_type === "bid" && (
                            <option value="hide_bid">Hide bid</option>
                          )}
                          {r.target_type === "booking" && (
                            <>
                              <option value="resolve_complete">Resolve dispute: mark completed</option>
                              <option value="resolve_cancel">Resolve dispute: mark cancelled</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor={`days-${r.id}`}>Days (if suspending)</label>
                        <input id={`days-${r.id}`} name="days" type="number" min={1} max={90} defaultValue={7} />
                      </div>
                    </div>

                    <div className="field" style={{ margin: "8px 0" }}>
                      <label htmlFor={`rsn-${r.id}`}>Mandatory reason (min 5 characters)</label>
                      <input id={`rsn-${r.id}`} name="reason" type="text" required minLength={5} placeholder="Audit reason..." />
                    </div>

                    <Submit className="btn btn-sm">Record action</Submit>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Appeals Queue */}
      <section aria-labelledby="appeals-heading" style={{ marginTop: 32 }}>
        <h2 id="appeals-heading">Open Account Appeals ({appeals.length})</h2>
        {appeals.length === 0 ? (
          <p className="meta">No open appeals.</p>
        ) : (
          <div className="grid">
            {appeals.map((a) => (
              <div key={a.id} className="card">
                <div className="row">
                  <strong>{a.display_name || "User"}</strong>
                  <span className="pill pill-bad">{statusLabel(a.account_status)}</span>
                  <span className="meta" style={{ marginInlineStart: "auto" }}>{dt(a.created_at)}</span>
                </div>
                {a.status_reason && <p className="hint">Original restriction reason: {a.status_reason}</p>}
                <p style={{ background: "#fff", padding: 8, borderRadius: 8, margin: "8px 0" }}>
                  &ldquo;{a.message}&rdquo;
                </p>

                <div className="row" style={{ marginTop: 10 }}>
                  <ActionForm action={moderateAction}>
                    <input type="hidden" name="targetType" value="user" />
                    <input type="hidden" name="targetId" value={a.user_id} />
                    <input type="hidden" name="action" value="reinstate" />
                    <input type="hidden" name="reason" value="Appeal accepted by moderator" />
                    <Submit className="btn btn-sm">Reinstate user</Submit>
                  </ActionForm>

                  <ActionForm action={appealCloseAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Submit className="btn btn-ghost btn-sm">Close appeal without change</Submit>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Identity Verification Review Queue */}
      <section aria-labelledby="identity-heading" style={{ marginTop: 32 }}>
        <h2 id="identity-heading">Worker Identity Review Queue ({idList.length})</h2>
        <div className="notice" style={{ marginBlock: 8 }}>
          <strong>Safety &amp; Compliance Rule:</strong> CNIC documents are kept in private storage and strictly audit-logged when viewed.
          Do NOT claim or imply NADRA verification. This is a visual manual review.
        </div>

        {idList.length === 0 ? (
          <p className="meta">No workers pending identity review.</p>
        ) : (
          <div className="grid">
            {idList.map((item) => (
              <div key={item.user_id} className="card">
                <div className="row">
                  <h3 style={{ margin: 0 }}>{item.display_name || "Worker"}</h3>
                  <IdentityBadge status={item.identity_status} />
                </div>

                <div style={{ marginBlock: 10 }}>
                  <strong>Submitted documents:</strong>
                  {item.docs.length === 0 ? (
                    <p className="hint">No documents found.</p>
                  ) : (
                    <ul style={{ margin: "4px 0" }}>
                      {item.docs.map((d) => (
                        <li key={d.id}>
                          {d.document_type} (submitted {dt(d.submitted_at)}) —{" "}
                          <a href={`/files/identity/${d.id}`} target="_blank" rel="noreferrer">
                            View image (logged)
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <ActionForm action={identityDecisionAction}>
                  <input type="hidden" name="userId" value={item.user_id} />
                  <div className="row">
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor={`dec-${item.user_id}`}>Decision</label>
                      <select id={`dec-${item.user_id}`} name="decision" required defaultValue="verified">
                        <option value="verified">Accept &amp; Mark &quot;ID reviewed&quot;</option>
                        <option value="needs_resubmission">Request clearer resubmission</option>
                        <option value="rejected">Reject documents</option>
                      </select>
                    </div>

                    <div className="field" style={{ margin: 0, flex: 1 }}>
                      <label htmlFor={`drsn-${item.user_id}`}>Reason note</label>
                      <input
                        id={`drsn-${item.user_id}`}
                        name="reason"
                        type="text"
                        required
                        minLength={5}
                        placeholder="e.g. Clear matching CNIC documents inspected"
                      />
                    </div>
                  </div>
                  <Submit className="btn btn-sm" style={{ marginTop: 8 }}>Record decision</Submit>
                </ActionForm>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Low-Bid Jobs: Matching Radius Expansion */}
      <section aria-labelledby="lowbids-heading" style={{ marginTop: 32 }}>
        <h2 id="lowbids-heading">Open Jobs with Few Bids ({lowBids.length})</h2>
        <p className="hint">
          Jobs that have received few bids. You can manually widen the matching radius to notify workers in neighbouring areas.
        </p>

        {lowBids.length === 0 ? (
          <p className="meta">All open jobs have sufficient bids or are fresh.</p>
        ) : (
          <div className="grid">
            {lowBids.map((j) => (
              <div key={j.id} className="card">
                <div className="row">
                  <strong><Link href={`/jobs/${j.id}`}>{j.title}</Link></strong>
                  <span className="pill" style={{ marginInlineStart: "auto" }}>
                    Stage {j.match_stage} ({j.match_radius_km} km)
                  </span>
                </div>
                <p className="meta" style={{ margin: "4px 0" }}>
                  {j.category} in {j.area} · {j.bids} active bid{j.bids === 1 ? "" : "s"} · {j.matched} workers notified · {j.age_h}h old
                </p>
                <div style={{ marginTop: 8 }}>
                  <ActionForm action={expandJobAction}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <Submit className="btn btn-ghost btn-sm">Widen radius &amp; notify more workers</Submit>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Marketplace Operational Settings */}
      <section aria-labelledby="settings-heading" style={{ marginTop: 32 }}>
        <h2 id="settings-heading">Marketplace Settings</h2>
        <ActionForm action={settingsAction} className="card">
          <div className="field">
            <label htmlFor="identity_policy">Worker identity requirement to bid</label>
            <select id="identity_policy" name="identity_policy" defaultValue={settings.identityPolicy}>
              <option value="open">Open (all active workers can bid, unverified show badge)</option>
              <option value="pending_ok">Pending OK (workers with pending or verified ID can bid)</option>
              <option value="verified_only">Verified only (only ID-reviewed workers can bid)</option>
            </select>
            <p className="hint">Controls which workers can view and bid on open jobs in the pilot.</p>
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="match_radius_km">Base match radius (km)</label>
              <input id="match_radius_km" name="match_radius_km" type="number" min={1} max={30} defaultValue={settings.matchRadiusKm} />
            </div>

            <div className="field">
              <label htmlFor="job_expiry_days">Default job expiry (days)</label>
              <input id="job_expiry_days" name="job_expiry_days" type="number" min={1} max={30} defaultValue={settings.jobExpiryDays} />
            </div>

            <div className="field">
              <label htmlFor="min_bids_target">Min bids target</label>
              <input id="min_bids_target" name="min_bids_target" type="number" min={1} max={10} defaultValue={settings.minBidsTarget} />
            </div>

            <div className="field">
              <label htmlFor="expand_after_hours">Expand after (hours)</label>
              <input id="expand_after_hours" name="expand_after_hours" type="number" min={1} max={72} defaultValue={settings.expandAfterHours} />
            </div>
          </div>

          <Submit>Save settings</Submit>
        </ActionForm>
      </section>

      {/* Recent Moderation History */}
      <section aria-labelledby="history-heading" style={{ marginTop: 32, marginBottom: 40 }}>
        <h2 id="history-heading">Recent Moderation Log</h2>
        {history.length === 0 ? (
          <p className="meta">No moderation actions recorded yet.</p>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((h) => (
                  <tr key={h.id}>
                    <td className="meta">{dt(h.created_at)}</td>
                    <td>{h.admin_name || "Admin"}</td>
                    <td><code>{h.action}</code></td>
                    <td>{h.target_type}:{h.target_id.slice(0, 8)}</td>
                    <td>{h.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
