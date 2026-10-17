import { q, one, tx, Db, isPostgresAvailable } from "./db";
import { SessionUser } from "./auth";
import { AppError, assertTransition, JobStatus, CONTACT_VISIBLE } from "./state";
import { jobSchema, parseOrThrow } from "./validation";
import { rateLimit } from "./ratelimit";
import { getSettings, identityStatuses } from "./settings";
import { eligibleSql, matchAndNotify } from "./matching";
import { putPrivate } from "./storage";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_JOB, photoUploadEnabled, ACTIVE_CITY_SLUG } from "./config";
import { audit } from "./audit";
import { log } from "./logger";
import { store, getCategories, getAreas } from "./store";

export async function logStatus(db: Db, jobId: string, from: JobStatus | null, to: JobStatus, actorId: string | null, note?: string) {
  if (await isPostgresAvailable()) {
    await q(`INSERT INTO job_status_log (job_id, from_status, to_status, actor_id, note) VALUES ($1,$2,$3,$4,$5)`,
      [jobId, from, to, actorId, note ?? null], db);
  }
}

/** Creates a DRAFT (private to the customer). Nothing is visible to workers until publishJob(). */
export async function createDraft(user: SessionUser, form: FormData): Promise<string> {
  await rateLimit(`job_create:${user.id}`, 5, 86400);
  const raw = Object.fromEntries(
    ["categoryId","areaId","title","description","budgetMin","budgetMax","preferredAt","addressText","contactNote","lat","lng","ack"].map((k) => [k, form.get(k) ?? undefined]),
  );
  const v = parseOrThrow(jobSchema, { ...raw, asap: form.get("asap") === "on" });

  const preferred = v.asap ? null : new Date(v.preferredAt.length === 16 ? `${v.preferredAt}:00+05:00` : v.preferredAt);
  if (preferred && (isNaN(preferred.getTime()) || preferred.getTime() < Date.now() - 3600_000))
    throw new AppError("Preferred time must be in the future.");

  if (!(await isPostgresAvailable())) {
    const openCount = store.listCustomerJobs(user.id).filter(j => ["draft", "open"].includes(j.status)).length;
    if (openCount >= 10) throw new AppError("You have too many open jobs. Close or cancel one first.");
    return store.createDraft(user.id, {
      categoryId: v.categoryId,
      areaId: v.areaId,
      title: v.title,
      description: v.description,
      budgetMin: v.budgetMin ?? undefined,
      budgetMax: v.budgetMax ?? undefined,
      asap: v.asap,
      preferredAt: preferred,
      addressText: v.addressText,
      contactNote: v.contactNote,
      lat: v.lat ? Number(v.lat) : undefined,
      lng: v.lng ? Number(v.lng) : undefined,
    });
  }

  const open = await one<{ n: number }>(`SELECT count(*)::int n FROM jobs WHERE customer_id=$1 AND status IN ('draft','open')`, [user.id]);
  if ((open?.n ?? 0) >= 10) throw new AppError("You have too many open jobs. Close or cancel one first.");

  const ok = await one(
    `SELECT 1 FROM service_categories c, service_areas a JOIN cities ci ON ci.id=a.city_id
     WHERE c.id=$1 AND c.active AND a.id=$2 AND a.active AND ci.active AND ci.slug=$3`,
    [v.categoryId, v.areaId, ACTIVE_CITY_SLUG],
  );
  if (!ok) throw new AppError("Choose an available category and a Lahore area.");

  const files = (form.getAll("photos") as File[]).filter((f) => f && f.size > 0);
  if (files.length > MAX_PHOTOS_PER_JOB) throw new AppError(`You can add up to ${MAX_PHOTOS_PER_JOB} photos.`);
  if (files.length && !photoUploadEnabled())
    throw new AppError("Photo uploads aren't enabled on this deployment. Post without photos.");
  const stored: { key: string; mime: string }[] = [];
  for (const f of files) stored.push(await putPrivate("job-photos", Buffer.from(await f.arrayBuffer()), MAX_PHOTO_BYTES));

  const s = await getSettings();
  return tx(async (c) => {
    const j = await one<{ id: string }>(
      `INSERT INTO jobs (customer_id, category_id, area_id, title, description, budget_min, budget_max, asap, preferred_at,
                         status, match_radius_km, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10, now() + ($11 || ' days')::interval) RETURNING id`,
      [user.id, v.categoryId, v.areaId, v.title, v.description, v.budgetMin, v.budgetMax, v.asap, preferred, s.matchRadiusKm, String(s.jobExpiryDays)],
      c,
    );
    const id = j!.id;
    const hasPin = v.lat && v.lng;
    await q(
      `INSERT INTO job_private (job_id, address_text, contact_note, precise_point)
       VALUES ($1,$2,$3, CASE WHEN $4::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($5::float8,$4::float8),4326)::geography END)`,
      [id, v.addressText, v.contactNote || null, hasPin ? Number(v.lat) : null, hasPin ? Number(v.lng) : null],
      c,
    );
    for (const p of stored)
      await q(`INSERT INTO job_photos (job_id, owner_id, storage_key, mime_type) VALUES ($1,$2,$3,$4)`, [id, user.id, p.key, p.mime], c);
    await logStatus(c, id, null, "draft", user.id);
    await audit(user.id, "job.draft_created", "job", id, { photos: stored.length }, c);
    return id;
  });
}

export async function publishJob(user: SessionUser, jobId: string): Promise<void> {
  if (!(await isPostgresAvailable())) {
    store.publishJob(user.id, jobId);
    return;
  }
  await tx(async (c) => {
    const j = await one<{ status: JobStatus }>(`SELECT status FROM jobs WHERE id=$1 AND customer_id=$2 FOR UPDATE`, [jobId, user.id], c);
    if (!j) throw new AppError("Job not found.", "not_found");
    assertTransition(j.status, "open", "customer");
    const s = await getSettings();
    await q(`UPDATE jobs SET status='open', published_at=now(), expires_at = now() + ($2 || ' days')::interval, updated_at=now() WHERE id=$1`,
      [jobId, String(s.jobExpiryDays)], c);
    await logStatus(c, jobId, j.status, "open", user.id);
    await audit(user.id, "job.published", "job", jobId, {}, c);
  });
  await matchAndNotify(jobId);
}

export async function createAndPublishJob(user: SessionUser, form: FormData): Promise<string> {
  const jobId = await createDraft(user, form);
  await publishJob(user, jobId);
  return jobId;
}

export async function cancelJob(user: SessionUser, jobId: string): Promise<void> {
  if (!(await isPostgresAvailable())) {
    store.cancelJob(user.id, jobId);
    return;
  }
  await tx(async (c) => {
    const j = await one<{ status: JobStatus }>(`SELECT status FROM jobs WHERE id=$1 AND customer_id=$2 FOR UPDATE`, [jobId, user.id], c);
    if (!j) throw new AppError("Job not found.", "not_found");
    assertTransition(j.status, "cancelled", "customer");
    await q(`UPDATE jobs SET status='cancelled', updated_at=now() WHERE id=$1`, [jobId], c);
    await q(`UPDATE bids SET status='rejected', updated_at=now() WHERE job_id=$1 AND status='active'`, [jobId], c);
    await logStatus(c, jobId, j.status, "cancelled", user.id);
  });
}

export type PublicJob = {
  id: string; title: string; description: string; category: string; area: string; status: JobStatus;
  budget_min: number | null; budget_max: number | null; asap: boolean; preferred_at: Date | null;
  created_at: Date; expires_at: Date; bid_count: number; my_bid_status: string | null;
  is_demo?: boolean;
};

/** Columns safe to show a bidder: NO job_private columns, ever. */
const PUBLIC_COLS = `j.id, j.title, j.description, c.name AS category, a.name AS area, j.status,
  j.budget_min, j.budget_max, j.asap, j.preferred_at, j.created_at, j.expires_at, j.is_demo`;

/** Safe discovery list for guests and landing page: approximate areas only, NO private details, NO bids */
export async function browsePublicJobs(): Promise<PublicJob[]> {
  if (!(await isPostgresAvailable())) {
    return store.getPublicJobs().map(j => ({ ...j, my_bid_status: null }));
  }
  return q<PublicJob>(
    `SELECT ${PUBLIC_COLS},
       (SELECT count(*)::int FROM bids b WHERE b.job_id=j.id AND b.status IN ('active','accepted')) AS bid_count,
       NULL::text AS my_bid_status
     FROM jobs j JOIN service_categories c ON c.id=j.category_id JOIN service_areas a ON a.id=j.area_id
     WHERE j.status='open' AND j.hidden_at IS NULL AND j.expires_at > now()
     ORDER BY j.created_at DESC LIMIT 50`,
  );
}

export async function browseJobsForWorker(user: SessionUser): Promise<PublicJob[]> {
  if (!(await isPostgresAvailable())) {
    return store.browseJobsForWorker(user.id);
  }
  const s = await getSettings();
  return q<PublicJob>(
    `SELECT ${PUBLIC_COLS},
       (SELECT count(*)::int FROM bids b WHERE b.job_id=j.id AND b.status IN ('active','accepted')) AS bid_count,
       (SELECT b.status::text FROM bids b WHERE b.job_id=j.id AND b.worker_id=$1 ORDER BY b.created_at DESC LIMIT 1) AS my_bid_status
     FROM jobs j JOIN service_categories c ON c.id=j.category_id JOIN service_areas a ON a.id=j.area_id
     WHERE j.status='open' AND j.hidden_at IS NULL AND j.expires_at > now() AND j.customer_id <> $1
       AND ${eligibleSql("$1::uuid", "$2")}
     ORDER BY j.created_at DESC LIMIT 50`,
    [user.id, identityStatuses(s.identityPolicy)],
  );
}

/** Authorisation for bidders: returns the public job only if this worker is eligible. */
export async function getEligibleJob(user: SessionUser, jobId: string): Promise<PublicJob | null> {
  if (!(await isPostgresAvailable())) {
    return store.getEligibleJob(user.id, jobId);
  }
  const s = await getSettings();
  return one<PublicJob>(
    `SELECT ${PUBLIC_COLS},
       (SELECT count(*)::int FROM bids b WHERE b.job_id=j.id AND b.status IN ('active','accepted')) AS bid_count,
       (SELECT b.status::text FROM bids b WHERE b.job_id=j.id AND b.worker_id=$1 ORDER BY b.created_at DESC LIMIT 1) AS my_bid_status
     FROM jobs j JOIN service_categories c ON c.id=j.category_id JOIN service_areas a ON a.id=j.area_id
     WHERE j.id=$3 AND j.hidden_at IS NULL AND j.customer_id <> $1 AND j.status='open'
       AND ${eligibleSql("$1::uuid", "$2")}`,
    [user.id, identityStatuses(s.identityPolicy), jobId],
  );
}

export type CustomerJob = PublicJob & { customer_id: string; hidden_at: Date | null; photo_ids: string[] };

export async function getCustomerJob(user: SessionUser, jobId: string): Promise<CustomerJob | null> {
  if (!(await isPostgresAvailable())) {
    return store.getCustomerJob(user.id, jobId);
  }
  return one<CustomerJob>(
    `SELECT ${PUBLIC_COLS}, j.customer_id, j.hidden_at,
       (SELECT count(*)::int FROM bids b WHERE b.job_id=j.id AND b.status IN ('active','accepted')) AS bid_count,
       NULL::text AS my_bid_status,
       COALESCE((SELECT array_agg(p.id::text ORDER BY p.created_at) FROM job_photos p WHERE p.job_id=j.id), '{}') AS photo_ids
     FROM jobs j JOIN service_categories c ON c.id=j.category_id JOIN service_areas a ON a.id=j.area_id
     WHERE j.id=$1 AND j.customer_id=$2`,
    [jobId, user.id],
  );
}

export async function listCustomerJobs(user: SessionUser) {
  if (!(await isPostgresAvailable())) {
    return store.listCustomerJobs(user.id);
  }
  return q<PublicJob>(
    `SELECT ${PUBLIC_COLS},
       (SELECT count(*)::int FROM bids b WHERE b.job_id=j.id AND b.status IN ('active','accepted')) AS bid_count, NULL::text AS my_bid_status
     FROM jobs j JOIN service_categories c ON c.id=j.category_id JOIN service_areas a ON a.id=j.area_id
     WHERE j.customer_id=$1 ORDER BY j.created_at DESC LIMIT 100`,
    [user.id],
  );
}

export type PrivateDetails = {
  address_text: string;
  contact_note: string | null;
  customer_phone: string;
  customer_name: string | null;
  worker_phone: string;
  worker_name: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Exact address + counterpart contact details. Allowed ONLY for the customer or the single selected worker
 * of a booking whose status is in CONTACT_VISIBLE. Everyone else (incl. admins) gets null.
 */
export async function getPrivateDetails(user: SessionUser, jobId: string): Promise<PrivateDetails | null> {
  if (!(await isPostgresAvailable())) {
    return store.getPrivateDetails(user.id, jobId);
  }
  const row = await one<PrivateDetails & { status: JobStatus }>(
    `SELECT p.address_text, p.contact_note,
            cu.phone AS customer_phone, cu.display_name AS customer_name,
            wu.phone AS worker_phone, wu.display_name AS worker_name,
            ST_Y(p.precise_point::geometry) AS lat, ST_X(p.precise_point::geometry) AS lng, b.status
     FROM bookings b
     JOIN job_private p ON p.job_id=b.job_id
     JOIN users cu ON cu.id=b.customer_id
     JOIN users wu ON wu.id=b.worker_id
     WHERE b.job_id=$1 AND (b.customer_id=$2 OR b.worker_id=$2)`,
    [jobId, user.id],
  );
  if (!row || !CONTACT_VISIBLE.includes(row.status)) return null;
  const { status: _s, ...d } = row;
  void _s;
  log.info("private_details_viewed", { jobId, viewer: user.id });
  return d;
}

export async function categoriesAndAreas() {
  if (!(await isPostgresAvailable())) {
    return {
      categories: getCategories().map(c => ({ id: c.id, name: c.name, slug: c.slug })),
      areas: getAreas().map(a => ({ id: a.id, name: a.name, lat: a.lat, lng: a.lng })),
    };
  }
  const [categories, areas] = await Promise.all([
    q<{ id: number; name: string; slug: string }>(`SELECT id, name, slug FROM service_categories WHERE active ORDER BY sort_order, name`),
    q<{ id: number; name: string; lat: number; lng: number }>(
      `SELECT a.id, a.name, ST_Y(a.centroid::geometry) AS lat, ST_X(a.centroid::geometry) AS lng
       FROM service_areas a JOIN cities c ON c.id=a.city_id WHERE a.active AND c.active AND c.slug=$1 ORDER BY a.name`,
      [ACTIVE_CITY_SLUG],
    ),
  ]);
  return { categories, areas };
}
