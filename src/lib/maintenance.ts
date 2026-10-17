import { q } from "./db";
import { getSettings } from "./settings";
import { expandJob } from "./matching";
import { purgeIdentityDocuments } from "./admin";
import { log } from "./logger";

/**
 * Periodic maintenance (run every ~15 min via `npm run maintenance` or GET /api/cron/maintenance):
 *  1. expire open jobs past expires_at (and expire their active bids)
 *  2. widen matching in stages for jobs with too few bids (never auto-selects anyone)
 *  3. purge identity documents past retention
 */
export async function runMaintenance() {
  const s = await getSettings();
  const expired = await q<{ id: string }>(
    `UPDATE jobs SET status='expired', updated_at=now() WHERE status='open' AND expires_at <= now() RETURNING id`);
  for (const j of expired) {
    await q(`UPDATE bids SET status='expired', updated_at=now() WHERE job_id=$1 AND status='active'`, [j.id]);
    await q(`INSERT INTO job_status_log (job_id, from_status, to_status, note) VALUES ($1,'open','expired','system: expiry')`, [j.id]);
  }
  const lowBid = await q<{ id: string }>(
    `SELECT j.id FROM jobs j
     WHERE j.status='open' AND j.hidden_at IS NULL
       AND COALESCE(j.last_expanded_at, j.published_at) <= now() - ($1 || ' hours')::interval
       AND (SELECT count(*) FROM bids b WHERE b.job_id=j.id AND b.status='active') < $2`,
    [String(s.expandAfterHours), s.minBidsTarget]);
  let expanded = 0;
  for (const j of lowBid) if (await expandJob(j.id)) expanded++;
  const purged = await purgeIdentityDocuments();
  await q(`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`);
  await q(`DELETE FROM otp_codes WHERE expires_at < now() - interval '1 day'`);
  const result = { expired: expired.length, expanded, purged };
  log.info("maintenance_done", result);
  return result;
}
