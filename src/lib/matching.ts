import { q, one, Db } from "./db";
import { getSettings, identityStatuses } from "./settings";
import { notify } from "./notify";
import { log } from "./logger";

/** Radius expansion stages (km added to the base radius). Stage 0 = base. */
const STAGE_RADII_ADD = [0, 2, 5, 9];
export const MAX_STAGE = STAGE_RADII_ADD.length - 1;

/**
 * SQL predicate: worker (param $W) may SEE a job (alias j). Public data only is selected by
 * callers. Distance uses the private pin server-side but never returns it.
 * Account must be active; category offered; area served or within the job's radius;
 * identity status allowed by policy (param $P is a text[]).
 */
export const eligibleSql = (w: string, p: string) => `
  EXISTS (SELECT 1 FROM users wu JOIN worker_profiles wp ON wp.user_id = wu.id
          WHERE wu.id = ${w} AND wu.deleted_at IS NULL AND wu.account_status = 'active'
            AND wp.identity_status::text = ANY(${p}::text[]))
  AND EXISTS (SELECT 1 FROM worker_categories wc WHERE wc.user_id = ${w} AND wc.category_id = j.category_id)
  AND EXISTS (
    SELECT 1 FROM worker_areas wa
    JOIN service_areas sa ON sa.id = wa.area_id
    JOIN service_areas ja ON ja.id = j.area_id
    LEFT JOIN job_private jp ON jp.job_id = j.id
    WHERE wa.user_id = ${w}
      AND (wa.area_id = j.area_id
           OR ST_DWithin(sa.centroid, COALESCE(jp.precise_point, ja.centroid), j.match_radius_km * 1000)))
`;

/** Notify newly eligible workers (accepting bids) of an open job. Each worker is notified once. */
export async function matchAndNotify(jobId: string, db?: Db): Promise<number> {
  const s = await getSettings();
  const job = await one<{ category: string; area: string; stage: number; radius: string; customer_id: string }>(
    `SELECT c.name AS category, a.name AS area, j.match_stage AS stage, j.match_radius_km::text AS radius, j.customer_id
     FROM jobs j JOIN service_categories c ON c.id=j.category_id JOIN service_areas a ON a.id=j.area_id
     WHERE j.id=$1 AND j.status='open' AND j.hidden_at IS NULL`,
    [jobId],
    db,
  );
  if (!job) return 0;

  const workers = await q<{ id: string }>(
    `SELECT wu.id FROM users wu JOIN worker_profiles wp ON wp.user_id = wu.id
     JOIN jobs j ON j.id = $1
     WHERE wp.accepting_bids AND wu.id <> j.customer_id AND ${eligibleSql("wu.id", "$2")}
       AND (wu.notification_prefs->>'in_app')::boolean IS NOT FALSE`,
    [jobId, identityStatuses(s.identityPolicy)],
    db,
  );

  let n = 0;
  for (const w of workers) {
    const ins = await one(
      `INSERT INTO match_events (job_id, worker_id, stage, radius_km) VALUES ($1,$2,$3,$4)
       ON CONFLICT (job_id, worker_id) DO NOTHING RETURNING id`,
      [jobId, w.id, job.stage, job.radius],
      db,
    );
    if (!ins) continue; // already notified in an earlier stage
    // Only category + public area: no title/description (customer free text) and nothing private.
    await notify(w.id, "job_match", `New ${job.category.toLowerCase()} job in ${job.area}`,
      "A customer in your service area is asking for bids. Open the job to see details.",
      { type: "job", id: jobId }, db);
    n++;
  }
  log.info("job_matched", { jobId, stage: job.stage, notified: n });
  return n;
}

/** Widen the matching radius by one stage and notify newly eligible workers. */
export async function expandJob(jobId: string, db?: Db): Promise<boolean> {
  const s = await getSettings();
  const j = await one<{ match_stage: number }>("SELECT match_stage FROM jobs WHERE id=$1 AND status='open'", [jobId], db);
  if (!j || j.match_stage >= MAX_STAGE) return false;
  const next = j.match_stage + 1;
  await q(
    `UPDATE jobs SET match_stage=$2, match_radius_km=$3, last_expanded_at=now(), updated_at=now() WHERE id=$1`,
    [jobId, next, s.matchRadiusKm + STAGE_RADII_ADD[next]],
    db,
  );
  await matchAndNotify(jobId, db);
  return true;
}

export function baseRadius(s: { matchRadiusKm: number }) {
  return s.matchRadiusKm;
}
