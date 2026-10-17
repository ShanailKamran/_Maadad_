import { q, one, tx, isPostgresAvailable } from "./db";
import { SessionUser } from "./auth";
import { AppError } from "./state";
import { reviewSchema, parseOrThrow, reportSchema } from "./validation";
import { REVEALED_SQL } from "./reputation";
import { rateLimit } from "./ratelimit";
import { notify } from "./notify";
import { audit } from "./audit";
import { store } from "./store";

/** Only a participant of a COMPLETED booking may review the other participant. One per booking. */
export async function submitReview(user: SessionUser, bookingId: string, form: FormData): Promise<void> {
  await rateLimit(`review:${user.id}`, 20, 86400);
  const v = parseOrThrow(reviewSchema, { stars: form.get("stars") ?? undefined, comment: form.get("comment") ?? undefined });

  if (!(await isPostgresAvailable())) {
    store.submitReview(user.id, bookingId, v.stars, v.comment);
    return;
  }

  await tx(async (c) => {
    const b = await one<{ id: string; customer_id: string; worker_id: string; status: string; job_id: string }>(
      `SELECT id, customer_id, worker_id, status, job_id FROM bookings WHERE id=$1 AND (customer_id=$2 OR worker_id=$2)`, [bookingId, user.id], c);
    if (!b) throw new AppError("Booking not found.", "not_found");
    if (b.status !== "completed") throw new AppError("You can review only after the job is completed.");
    const reviewee = b.customer_id === user.id ? b.worker_id : b.customer_id;
    try {
      await q(`INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, stars, comment) VALUES ($1,$2,$3,$4,$5)`,
        [b.id, user.id, reviewee, v.stars, v.comment || null], c);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new AppError("You've already reviewed this booking.");
      throw e;
    }
    await audit(user.id, "review.created", "booking", b.id, { stars: v.stars }, c);
    await notify(reviewee, "review_received", "You received a review",
      "Reviews become visible when both sides have reviewed, or after 7 days.", { type: "job", id: b.job_id }, c);
  });
}

export async function reviewStateForBooking(user: SessionUser, bookingId: string) {
  if (!(await isPostgresAvailable())) {
    return store.reviewStateForBooking(user.id, bookingId);
  }
  return one<{ mine: boolean; theirs: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM reviews WHERE booking_id=$1 AND reviewer_id=$2) AS mine,
            EXISTS(SELECT 1 FROM reviews WHERE booking_id=$1 AND reviewer_id<>$2) AS theirs`, [bookingId, user.id]);
}

export type ReviewRow = { id: string; stars: number; comment: string | null; created_at: Date; reviewer_name: string | null };

/** Public-facing: only revealed, non-hidden reviews. */
export async function revealedReviewsFor(userId: string): Promise<ReviewRow[]> {
  if (!(await isPostgresAvailable())) {
    return store.revealedReviewsFor(userId);
  }
  return q<ReviewRow>(
    `SELECT r.id, r.stars, r.comment, r.created_at, u.display_name AS reviewer_name
     FROM reviews r JOIN users u ON u.id=r.reviewer_id
     WHERE r.reviewee_id=$1 AND ${REVEALED_SQL} ORDER BY r.created_at DESC LIMIT 50`, [userId]);
}

/** Report a user, job, bid, review or booking. Reporter learns nothing about the target. */
export async function createReport(user: SessionUser, form: FormData): Promise<void> {
  await rateLimit(`report:${user.id}`, 10, 86400);
  const v = parseOrThrow(reportSchema, Object.fromEntries(["targetType", "targetId", "category", "details"].map((k) => [k, form.get(k) ?? undefined])));

  if (!(await isPostgresAvailable())) {
    store.createReport(user.id, v.targetType, v.targetId, v.category, v.details);
    return;
  }

  const table = { user: "users", job: "jobs", bid: "bids", review: "reviews", booking: "bookings" }[v.targetType];
  const exists = await one(`SELECT 1 FROM ${table} WHERE id=$1`, [v.targetId]); // table is from a fixed map, never user text
  if (!exists) throw new AppError("We couldn't find what you're reporting.");
  if (v.targetType === "user" && v.targetId === user.id) throw new AppError("You can't report yourself.");
  try {
    await q(`INSERT INTO reports (reporter_id, target_type, target_id, category, details) VALUES ($1,$2,$3,$4,$5)`,
      [user.id, v.targetType, v.targetId, v.category, v.details || null]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AppError("You've already reported this for that reason. We'll review it.");
    throw e;
  }
  await audit(user.id, "report.created", v.targetType, v.targetId, { category: v.category });
}
