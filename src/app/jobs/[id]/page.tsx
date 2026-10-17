import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCustomerJob, getEligibleJob, getPrivateDetails } from "@/lib/jobs";
import { listBidsForCustomer } from "@/lib/bids";
import { getBookingByJob, codeForCustomer } from "@/lib/bookings";
import { reviewStateForBooking } from "@/lib/reviews";
import { q, isPostgresAvailable } from "@/lib/db";
import { store } from "@/lib/store";
import { pkr, dt, budgetText, statusLabel } from "@/lib/format";
import { ActionForm, Submit } from "@/components/ActionForm";
import { PaymentNotice, Stars, IdentityBadge, DemoPill } from "@/components/ui";
import {
  acceptBidAction,
  cancelJobAction,
  withdrawBidAction,
  submitBidAction,
  progressAction,
  reportProblemAction,
  reviewAction,
  reportAction,
} from "../../actions";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return { title: "Job details" };
}

export default async function JobPage({ params }: { params: { id: string } }) {
  if (!params.id || typeof params.id !== "string" || params.id.length < 3) notFound();

  const user = await requireUser();
  const jobId = params.id;

  // Check user role for this job
  const customerJob = await getCustomerJob(user, jobId);
  const isCustomer = Boolean(customerJob);

  const booking = await getBookingByJob(user, jobId);
  const isSelectedWorker = Boolean(booking && booking.worker_id === user.id);

  let eligibleJob = null;
  if (!isCustomer && !isSelectedWorker && user.is_worker) {
    eligibleJob = await getEligibleJob(user, jobId);
  }

  // Admin view check
  let adminJob = null;
  if (!isCustomer && !isSelectedWorker && !eligibleJob && user.is_admin) {
    if (!(await isPostgresAvailable())) {
      const sj = store.jobs.get(jobId);
      if (sj) {
        adminJob = {
          id: sj.id,
          title: sj.title,
          description: sj.description,
          category: store.getPublicJobs().find(pj => pj.id === sj.id)?.category ?? "Service",
          area: store.getPublicJobs().find(pj => pj.id === sj.id)?.area ?? "Lahore",
          status: sj.status,
          budget_min: sj.budget_min,
          budget_max: sj.budget_max,
          asap: sj.asap,
          preferred_at: sj.preferred_at,
          created_at: sj.created_at,
          expires_at: sj.expires_at,
          customer_id: sj.customer_id,
          is_demo: sj.is_demo,
        };
      }
    } else {
      adminJob = (
        await q<{
          id: string; title: string; description: string; category: string; area: string;
          status: string; budget_min: number | null; budget_max: number | null;
          asap: boolean; preferred_at: Date | null; created_at: Date; expires_at: Date;
          customer_id: string; is_demo: boolean;
        }>(
          `SELECT j.id, j.title, j.description, c.name AS category, a.name AS area, j.status::text,
                  j.budget_min, j.budget_max, j.asap, j.preferred_at, j.created_at, j.expires_at,
                  j.customer_id, j.is_demo
           FROM jobs j
           JOIN service_categories c ON c.id=j.category_id
           JOIN service_areas a ON a.id=j.area_id
           WHERE j.id = $1`,
          [jobId],
        )
      )[0];
    }
  }

  if (!customerJob && !isSelectedWorker && !eligibleJob && !adminJob) {
    notFound();
  }

  const job = customerJob || eligibleJob || adminJob || {
    id: booking!.job_id,
    title: booking!.title,
    description: "",
    category: "",
    area: "",
    status: booking!.status,
    budget_min: null,
    budget_max: null,
    asap: false,
    preferred_at: null,
    created_at: booking!.selected_at,
    expires_at: booking!.selected_at,
  };

  // Fetch photos if any
  const photos = !(await isPostgresAvailable())
    ? []
    : await q<{ id: string }>(
        `SELECT id FROM job_photos WHERE job_id = $1 ORDER BY created_at`,
        [jobId],
      );

  // Private counterpart details (visible ONLY to customer and selected worker during active booking)
  const priv = await getPrivateDetails(user, jobId);
  const custCode = booking ? codeForCustomer(booking, user) : null;

  // Bids comparison for customer
  const bids = isCustomer && job.status === "open" ? await listBidsForCustomer(user, jobId) : [];

  // Review status if completed
  const reviewState = booking && booking.status === "completed"
    ? await reviewStateForBooking(user, booking.id)
    : null;

  // Existing worker bid (if viewer is worker)
  const workerExistingBid = user.is_worker
    ? (!(await isPostgresAvailable())
        ? (Array.from(store.bids.values()).find(b => b.job_id === jobId && b.worker_id === user.id && ["active", "accepted"].includes(b.status)) || null)
        : (
            await q<{ id: string; amount: number; timing_text: string; message: string; inclusions: string; exclusions: string; status: string }>(
              `SELECT id, amount, timing_text, message, inclusions, exclusions, status::text
               FROM bids WHERE job_id = $1 AND worker_id = $2 AND status IN ('active', 'accepted')`,
              [jobId, user.id],
            )
          )[0] || null)
    : null;

  const bindSubmitBid = submitBidAction.bind(null, jobId);

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, marginInlineEnd: "auto" }}>{job.title}</h1>
        <span className="pill">{statusLabel(job.status)}</span>
        {"is_demo" in job && job.is_demo && <DemoPill />}
      </div>

      <PaymentNotice />

      {/* Main Job Card */}
      <article className="card">
        <p className="meta">
          {"category" in job && job.category ? `${job.category} · ` : ""}
          {"area" in job && job.area ? `${job.area}, Lahore · ` : ""}
          {job.asap ? "As soon as possible" : dt(job.preferred_at)}
        </p>

        {"description" in job && job.description && (
          <p style={{ whiteSpace: "pre-wrap", marginBlock: 12 }}>{job.description}</p>
        )}

        <p>
          <strong>Budget: </strong>
          {budgetText(job.budget_min, job.budget_max)}
        </p>

        {photos.length > 0 && (
          <div>
            <strong>Job photos:</strong>
            <div className="photos" style={{ marginTop: 8 }}>
              {photos.map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={p.id} src={`/files/job-photo/${p.id}`} alt="Job detail" />
              ))}
            </div>
          </div>
        )}

        <p className="hint">Posted {dt(job.created_at)}</p>

        {isCustomer && job.status === "open" && (
          <div style={{ marginTop: 16 }}>
            <ActionForm action={cancelJobAction} confirm="Are you sure you want to cancel this job? All active bids will be rejected.">
              <input type="hidden" name="jobId" value={jobId} />
              <Submit className="btn btn-ghost btn-sm">Cancel this job</Submit>
            </ActionForm>
          </div>
        )}
      </article>

      {/* Private Details Box (Shown ONLY when booking is active and user is participant) */}
      {priv && (
        <section className="card" style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 17, 23, 0.95) 100%)" }}>
          <h2 style={{ marginTop: 0, color: "var(--emerald-300)" }}>Booking &amp; Private Contact Information</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Shared exclusively between the customer and the selected worker for this job.
          </p>

          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <strong>Job exact address:</strong>
              <p style={{ margin: "4px 0" }}>{priv.address_text}</p>
              {priv.contact_note && (
                <p className="meta" style={{ margin: 0 }}>Access note: {priv.contact_note}</p>
              )}
            </div>

            <div>
              {isCustomer ? (
                <>
                  <strong>Selected worker contact:</strong>
                  <p style={{ margin: "4px 0" }}>{priv.worker_name || "Worker"}</p>
                  <p style={{ margin: 0 }}>
                    <a href={`tel:${priv.worker_phone}`}>{priv.worker_phone}</a>
                  </p>
                </>
              ) : (
                <>
                  <strong>Customer contact:</strong>
                  <p style={{ margin: "4px 0" }}>{priv.customer_name || "Customer"}</p>
                  <p style={{ margin: 0 }}>
                    <a href={`tel:${priv.customer_phone}`}>{priv.customer_phone}</a>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Customer completion code */}
          {custCode && (
            <div className="notice notice-dev" style={{ marginTop: 16 }}>
              <strong>Your completion code: </strong>
              <span style={{ fontSize: "1.3rem", fontWeight: 800, letterSpacing: 2 }}>{custCode}</span>
              <p className="hint" style={{ margin: "4px 0 0" }}>
                Tell this 4-digit code to your worker only when the work is finished to your satisfaction.
                Entering this code confirms completion status (payment is still settled directly with the worker).
              </p>
            </div>
          )}
        </section>
      )}

      {/* Booking State Actions */}
      {booking && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Booking status: {statusLabel(booking.status)}</h2>
          <p>
            <strong>Agreed Labour Price: </strong> {pkr(booking.amount)} (settled directly between you)
          </p>

          {/* Worker Actions */}
          {isSelectedWorker && (
            <div>
              {booking.status === "awarded" && (
                <div style={{ marginTop: 12 }}>
                  <p>You have been selected! Mark arrival when you arrive or start work.</p>
                  <ActionForm action={progressAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="jobId" value={jobId} />
                    <input type="hidden" name="action" value="start" />
                    <Submit>Mark arrival / Start work</Submit>
                  </ActionForm>
                </div>
              )}

              {booking.status === "in_progress" && (
                <div style={{ marginTop: 12 }}>
                  <p>Work is in progress. When done, request completion from the customer.</p>
                  <ActionForm action={progressAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="jobId" value={jobId} />
                    <input type="hidden" name="action" value="request_completion" />
                    <div className="field">
                      <label htmlFor="code">Optional: Customer&apos;s 4-digit completion code</label>
                      <input
                        id="code"
                        name="code"
                        type="text"
                        pattern="\d{4}"
                        maxLength={4}
                        placeholder="e.g. 1234"
                        style={{ maxWidth: 160 }}
                      />
                      <p className="hint">If the customer gives you their 4-digit code, enter it to complete immediately.</p>
                    </div>
                    <Submit>Request completion</Submit>
                  </ActionForm>
                </div>
              )}

              {booking.status === "completion_requested" && (
                <div className="notice">
                  You requested completion. Waiting for the customer to confirm.
                </div>
              )}
            </div>
          )}

          {/* Customer Actions */}
          {isCustomer && (
            <div>
              {booking.status === "completion_requested" && (
                <div style={{ marginTop: 12 }}>
                  <p className="notice">
                    The worker indicated work is completed. Please check the work and confirm.
                  </p>
                  <div className="row">
                    <ActionForm action={progressAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="jobId" value={jobId} />
                      <input type="hidden" name="action" value="confirm" />
                      <Submit>Confirm completion</Submit>
                    </ActionForm>

                    <ActionForm action={progressAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="jobId" value={jobId} />
                      <input type="hidden" name="action" value="not_finished" />
                      <Submit className="btn btn-ghost">Not finished yet</Submit>
                    </ActionForm>
                  </div>
                </div>
              )}

              {booking.status === "awarded" && (
                <div style={{ marginTop: 12 }}>
                  <ActionForm action={progressAction} confirm="Are you sure you want to cancel this booking before work starts?">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="jobId" value={jobId} />
                    <input type="hidden" name="action" value="cancel" />
                    <Submit className="btn btn-ghost btn-sm">Cancel booking</Submit>
                  </ActionForm>
                </div>
              )}
            </div>
          )}

          {/* Either party reporting problem on active booking */}
          {(booking.status === "awarded" || booking.status === "in_progress" || booking.status === "completion_requested") && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", color: "#8a1c13", fontWeight: 600 }}>
                Dispute / Report a problem with this booking
              </summary>
              <div style={{ marginTop: 8 }}>
                <p className="hint">
                  Marking a booking disputed alerts moderators. Note: <PaymentNotice />
                </p>
                <ActionForm action={reportProblemAction} confirm="Report a problem? This marks the booking disputed for moderator review.">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="jobId" value={jobId} />
                  <div className="field">
                    <label htmlFor="details">Describe the problem</label>
                    <textarea id="details" name="details" required maxLength={1500} />
                  </div>
                  <Submit className="btn btn-danger btn-sm">Mark disputed and report problem</Submit>
                </ActionForm>
              </div>
            </details>
          )}

          {booking.status === "disputed" && (
            <p className="msg msg-error">
              This booking is marked disputed and is in the moderator queue for review.
            </p>
          )}

          {/* Reviews after completion */}
          {booking.status === "completed" && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <h3>Ratings &amp; Reviews</h3>
              {reviewState?.mine ? (
                <p className="msg msg-ok">
                  You submitted your review. Reviews become visible once both parties have submitted, or after 7 days.
                </p>
              ) : (
                <ActionForm action={reviewAction}>
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <p className="lead">How was your experience with the {isCustomer ? "worker" : "customer"}?</p>
                  <div className="field">
                    <label htmlFor="stars">Rating (1 to 5 stars)</label>
                    <select id="stars" name="stars" required defaultValue="5" style={{ maxWidth: 160 }}>
                      <option value="5">★★★★★ 5 - Excellent</option>
                      <option value="4">★★★★☆ 4 - Good</option>
                      <option value="3">★★★☆☆ 3 - Average</option>
                      <option value="2">★★☆☆☆ 2 - Poor</option>
                      <option value="1">★☆☆☆☆ 1 - Terrible</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="comment">Written review (optional)</label>
                    <textarea id="comment" name="comment" maxLength={1000} placeholder="Provide helpful, honest feedback..." />
                  </div>
                  <Submit>Submit review</Submit>
                </ActionForm>
              )}
            </div>
          )}
        </section>
      )}

      {/* Customer: Bids comparison section */}
      {isCustomer && job.status === "open" && (
        <section aria-labelledby="bids-section" style={{ marginTop: 24 }}>
          <h2 id="bids-section">
            Received Bids ({bids.length})
          </h2>
          {bids.length === 0 ? (
            <div className="card empty">
              <p>No bids received yet. Eligible workers in your area have been notified.</p>
            </div>
          ) : (
            <div className="grid">
              {bids.map((b) => (
                <div key={b.id} className="card" style={{ border: "1px solid var(--line)" }}>
                  <div className="row">
                    <div>
                      <h3 style={{ margin: 0 }}>{b.worker_name || "Independent Worker"}</h3>
                      <p className="meta" style={{ margin: "2px 0 6px" }}>
                        {b.experience_years ? `${b.experience_years} yrs exp · ` : ""}
                        {b.categories.join(", ")}
                      </p>
                    </div>
                    <div style={{ marginInlineStart: "auto", textAlign: "end" }}>
                      <span className="price">{pkr(b.amount)}</span>
                      <p className="hint" style={{ margin: 0 }}>Labour offer</p>
                    </div>
                  </div>

                  <div className="row" style={{ marginBlock: 6 }}>
                    <Stars avg={b.rep?.rating_avg} count={b.rep?.rating_count ?? 0} />
                    <span className="meta">· {b.rep?.completed_as_worker ?? 0} completed jobs</span>
                    <IdentityBadge status={b.identity_status} />
                  </div>

                  <p style={{ margin: "8px 0" }}>
                    <strong>Expected window: </strong> {b.timing_text}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{b.message}</p>

                  {b.inclusions && (
                    <p className="hint"><strong>Includes:</strong> {b.inclusions}</p>
                  )}
                  {b.exclusions && (
                    <p className="hint"><strong>Excludes:</strong> {b.exclusions}</p>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <ActionForm
                      action={acceptBidAction}
                      confirm={`Accept this bid for ${pkr(b.amount)} from ${b.worker_name || "this worker"}? Other bids will be closed.`}
                    >
                      <input type="hidden" name="bidId" value={b.id} />
                      <input type="hidden" name="jobId" value={jobId} />
                      <Submit>Accept this bid</Submit>
                    </ActionForm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Eligible Worker: Bidding section */}
      {!isCustomer && user.is_worker && job.status === "open" && (
        <section aria-labelledby="bid-form-section" style={{ marginTop: 24 }}>
          <h2 id="bid-form-section">
            {workerExistingBid ? "Your Submitted Bid" : "Submit a Bid for this Job"}
          </h2>

          {workerExistingBid ? (
            <div className="card">
              <div className="row">
                <span className="price">{pkr(workerExistingBid.amount)}</span>
                <span className="pill" style={{ marginInlineStart: "auto" }}>{statusLabel(workerExistingBid.status)}</span>
              </div>
              <p><strong>Arrival/Completion:</strong> {workerExistingBid.timing_text}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{workerExistingBid.message}</p>
              {workerExistingBid.inclusions && <p className="hint"><strong>Includes:</strong> {workerExistingBid.inclusions}</p>}
              {workerExistingBid.exclusions && <p className="hint"><strong>Excludes:</strong> {workerExistingBid.exclusions}</p>}

              <div className="row" style={{ marginTop: 12 }}>
                <ActionForm action={withdrawBidAction} confirm="Withdraw your bid?">
                  <input type="hidden" name="bidId" value={workerExistingBid.id} />
                  <input type="hidden" name="jobId" value={jobId} />
                  <Submit className="btn btn-ghost btn-sm">Withdraw bid</Submit>
                </ActionForm>
              </div>
            </div>
          ) : null}

          {/* Form to submit or update bid */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{workerExistingBid ? "Update Your Bid" : "Enter Bid Details"}</h3>
            <ActionForm action={bindSubmitBid}>
              <div className="field">
                <label htmlFor="amount">Total labour price (whole PKR)</label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  step={50}
                  required
                  defaultValue={workerExistingBid?.amount ?? ""}
                  placeholder="e.g. 1500"
                />
                <p className="hint">Enter your labour offer. Materials are arranged with the customer.</p>
              </div>

              <div className="field">
                <label htmlFor="timingText">Expected arrival / completion window</label>
                <input
                  id="timingText"
                  name="timingText"
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  defaultValue={workerExistingBid?.timing_text ?? ""}
                  placeholder="e.g. Today between 3 PM and 5 PM"
                />
              </div>

              <div className="field">
                <label htmlFor="message">Message to customer</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  minLength={5}
                  maxLength={800}
                  defaultValue={workerExistingBid?.message ?? ""}
                  placeholder="Describe your approach, tools you carry, etc."
                />
              </div>

              <div className="field">
                <label htmlFor="inclusions">What the price includes (optional)</label>
                <input
                  id="inclusions"
                  name="inclusions"
                  type="text"
                  maxLength={500}
                  defaultValue={workerExistingBid?.inclusions ?? ""}
                  placeholder="e.g. Labour, diagnosis, basic seal tape"
                />
              </div>

              <div className="field">
                <label htmlFor="exclusions">What the price excludes (optional)</label>
                <input
                  id="exclusions"
                  name="exclusions"
                  type="text"
                  maxLength={500}
                  defaultValue={workerExistingBid?.exclusions ?? ""}
                  placeholder="e.g. Replacement tap, major piping replacement"
                />
              </div>

              <Submit>{workerExistingBid ? "Update bid" : "Send bid"}</Submit>
            </ActionForm>
          </div>
        </section>
      )}

      {/* Report Section */}
      <section style={{ marginTop: 32 }}>
        <details>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.9rem" }}>
            Report an issue or violation regarding this job
          </summary>
          <div className="card" style={{ marginTop: 8 }}>
            <ActionForm action={reportAction}>
              <input type="hidden" name="targetType" value="job" />
              <input type="hidden" name="targetId" value={jobId} />
              <div className="field">
                <label htmlFor="category">Reason for report</label>
                <select id="category" name="category" required defaultValue="spam">
                  <option value="spam">Spam or fake post</option>
                  <option value="misleading_price">Misleading price</option>
                  <option value="harassment">Harassment</option>
                  <option value="suspected_fraud">Suspected fraud</option>
                  <option value="unsafe_conduct">Unsafe conduct</option>
                  <option value="inappropriate_content">Inappropriate content</option>
                  <option value="other">Other issue</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="reportDetails">Details</label>
                <textarea id="reportDetails" name="details" maxLength={1500} placeholder="Please provide specific details..." />
              </div>
              <Submit className="btn btn-ghost btn-sm">Submit report to moderators</Submit>
            </ActionForm>
          </div>
        </details>
      </section>
    </div>
  );
}
