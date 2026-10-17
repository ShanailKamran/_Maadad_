import { q, isPostgresAvailable } from "./db";
import { reviewRevealDays } from "./config";
import { store } from "./store";

/**
 * Anti-retaliation rule (documented in docs/DECISIONS.md): a review is "revealed" when the
 * counterpart has also reviewed the same booking, OR reviewRevealDays have passed.
 * Hidden-by-moderation reviews never count. Aliases: r = reviews row.
 */
export const REVEALED_SQL = `(r.status = 'visible' AND (
  EXISTS (SELECT 1 FROM reviews o WHERE o.booking_id = r.booking_id AND o.id <> r.id)
  OR r.created_at + interval '${Number(reviewRevealDays)} days' <= now()))`;

export type Reputation = {
  user_id: string;
  rating_count: number;
  rating_avg: number | null;
  completed_as_worker: number;
  completed_as_customer: number;
};

export async function reputationFor(ids: string[]): Promise<Map<string, Reputation>> {
  if (ids.length === 0) return new Map();
  if (!(await isPostgresAvailable())) {
    return store.reputationFor(ids);
  }
  const rows = await q<Reputation>(
    `SELECT u.id AS user_id,
       (SELECT count(*)::int FROM reviews r WHERE r.reviewee_id = u.id AND ${REVEALED_SQL}) AS rating_count,
       (SELECT round(avg(r.stars)::numeric, 1)::float FROM reviews r WHERE r.reviewee_id = u.id AND ${REVEALED_SQL}) AS rating_avg,
       (SELECT count(*)::int FROM bookings b WHERE b.worker_id = u.id AND b.status = 'completed') AS completed_as_worker,
       (SELECT count(*)::int FROM bookings b WHERE b.customer_id = u.id AND b.status = 'completed') AS completed_as_customer
     FROM users u WHERE u.id = ANY($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((r) => [r.user_id, r]));
}
