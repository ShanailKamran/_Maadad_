import { q, one, tx, isPostgresAvailable } from "./db";
import { SessionUser, logout } from "./auth";
import { AppError } from "./state";
import { workerProfileSchema, parseOrThrow } from "./validation";
import { putPrivate, deletePrivate } from "./storage";
import { identityUploadEnabled, MAX_PHOTO_BYTES, MAX_WORKER_PHOTOS, photoUploadEnabled } from "./config";
import { audit } from "./audit";
import { rateLimit } from "./ratelimit";
import { store } from "./store";

export async function saveWorkerProfile(user: SessionUser | { id: string }, form: FormData): Promise<void> {
  const v = parseOrThrow(workerProfileSchema, {
    displayName: form.get("displayName") ?? undefined,
    bio: form.get("bio") ?? undefined,
    experienceYears: form.get("experienceYears") ?? 0,
    categoryIds: form.getAll("categoryIds"),
    areaIds: form.getAll("areaIds"),
    acceptingBids: form.get("acceptingBids") === "on",
  });

  if (!(await isPostgresAvailable())) {
    store.saveWorkerProfile(user.id, {
      displayName: v.displayName,
      bio: v.bio,
      experienceYears: v.experienceYears,
      categoryIds: v.categoryIds,
      areaIds: v.areaIds,
      acceptingBids: v.acceptingBids,
    });
    return;
  }

  await tx(async (c) => {
    const okCats = await one<{ n: number }>("SELECT count(*)::int n FROM service_categories WHERE id = ANY($1::int[]) AND active", [v.categoryIds], c);
    const okAreas = await one<{ n: number }>(
      "SELECT count(*)::int n FROM service_areas a JOIN cities ci ON ci.id=a.city_id WHERE a.id = ANY($1::int[]) AND a.active AND ci.active", [v.areaIds], c);
    if (okCats!.n !== new Set(v.categoryIds).size || okAreas!.n !== new Set(v.areaIds).size) throw new AppError("Choose from the available services and Lahore areas.");
    await q("UPDATE users SET display_name=$2, is_worker=true, updated_at=now() WHERE id=$1", [user.id, v.displayName], c);
    await q(
      `INSERT INTO worker_profiles (user_id, bio, experience_years, accepting_bids) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET bio=EXCLUDED.bio, experience_years=EXCLUDED.experience_years, accepting_bids=EXCLUDED.accepting_bids, updated_at=now()`,
      [user.id, v.bio, v.experienceYears, v.acceptingBids], c);
    await q("DELETE FROM worker_categories WHERE user_id=$1", [user.id], c);
    await q("DELETE FROM worker_areas WHERE user_id=$1", [user.id], c);
    for (const id of new Set(v.categoryIds)) await q("INSERT INTO worker_categories VALUES ($1,$2)", [user.id, id], c);
    for (const id of new Set(v.areaIds)) await q("INSERT INTO worker_areas VALUES ($1,$2)", [user.id, id], c);
    await audit(user.id, "worker.profile_saved", "user", user.id, {}, c);
  });
}

export async function addWorkerPhoto(user: SessionUser, file: File): Promise<void> {
  if (!photoUploadEnabled()) throw new AppError("Photo uploads aren't enabled on this deployment.");
  const n = await one<{ n: number }>("SELECT count(*)::int n FROM worker_photos WHERE user_id=$1", [user.id]);
  if ((n?.n ?? 0) >= MAX_WORKER_PHOTOS) throw new AppError(`You can add up to ${MAX_WORKER_PHOTOS} work photos.`);
  const p = await putPrivate("worker-photos", Buffer.from(await file.arrayBuffer()), MAX_PHOTO_BYTES);
  await q("INSERT INTO worker_photos (user_id, storage_key, mime_type) VALUES ($1,$2,$3)", [user.id, p.key, p.mime]);
}

export async function removeWorkerPhoto(user: SessionUser, id: string): Promise<void> {
  const r = await one<{ storage_key: string }>("DELETE FROM worker_photos WHERE id=$1 AND user_id=$2 RETURNING storage_key", [id, user.id]);
  if (r) await deletePrivate(r.storage_key);
}

/**
 * CNIC images → PRIVATE storage only, and only when identityUploadEnabled() (local dev with the
 * local private driver). No NADRA lookup exists. No CNIC number is collected.
 */
export async function submitIdentity(user: SessionUser, form: FormData): Promise<void> {
  if (!identityUploadEnabled())
    throw new AppError("Identity upload is disabled: secure private storage isn't configured for this deployment.");
  await rateLimit(`identity:${user.id}`, 6, 86400);

  if (!(await isPostgresAvailable())) {
    const wp = store.getWorkerProfile(user.id);
    if (!wp) throw new AppError("Create your worker profile first.");
    if (wp.identity_status === "verified") throw new AppError("Your identity review is already complete.");
    const front = form.get("cnic_front") as File | null, back = form.get("cnic_back") as File | null;
    if (!front?.size || !back?.size) throw new AppError("Please add both the front and back photos.");
    const realWp = store.workerProfiles.get(user.id);
    if (realWp) {
      realWp.identity_status = "pending_review";
      realWp.updated_at = new Date();
    }
    store.audit(user.id, "identity.submitted", "user", user.id);
    return;
  }

  const wp = await one<{ identity_status: string }>("SELECT identity_status::text FROM worker_profiles WHERE user_id=$1", [user.id]);
  if (!wp) throw new AppError("Create your worker profile first.");
  if (wp.identity_status === "verified") throw new AppError("Your identity review is already complete.");
  const front = form.get("cnic_front") as File | null, back = form.get("cnic_back") as File | null;
  if (!front?.size || !back?.size) throw new AppError("Please add both the front and back photos.");
  const stored = [
    { type: "cnic_front", ...(await putPrivate("identity", Buffer.from(await front.arrayBuffer()), 2_500_000)) },
    { type: "cnic_back", ...(await putPrivate("identity", Buffer.from(await back.arrayBuffer()), 2_500_000)) },
  ];
  const old = await tx(async (c) => {
    const prev = await q<{ id: string; storage_key: string }>(
      "SELECT id, storage_key FROM identity_documents WHERE user_id=$1 AND deleted_at IS NULL AND storage_key IS NOT NULL", [user.id], c);
    await q("UPDATE identity_documents SET storage_key=NULL, deleted_at=now() WHERE user_id=$1 AND deleted_at IS NULL", [user.id], c);
    for (const s of stored)
      await q("INSERT INTO identity_documents (user_id, storage_key, document_type, mime_type) VALUES ($1,$2,$3,$4)", [user.id, s.key, s.type, s.mime], c);
    await q("UPDATE worker_profiles SET identity_status='pending_review', updated_at=now() WHERE user_id=$1", [user.id], c);
    await audit(user.id, "identity.submitted", "user", user.id, {}, c);
    return prev;
  });
  for (const o of old) await deletePrivate(o.storage_key); // superseded uploads are securely removed
}

export async function updateNotificationPrefs(user: SessionUser, inApp: boolean) {
  if (!(await isPostgresAvailable())) return;
  // push/sms stay false: those channels are not implemented.
  await q("UPDATE users SET notification_prefs = $2::jsonb WHERE id=$1", [user.id, JSON.stringify({ in_app: inApp, push: false, sms: false })]);
}

export async function updateDisplayName(user: SessionUser, name: string, asCustomer = true) {
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 60) throw new AppError("Name must be 2–60 characters.");
  if (!(await isPostgresAvailable())) {
    const u = store.users.get(user.id);
    if (u) {
      u.display_name = n;
      u.is_customer = asCustomer;
      u.updated_at = new Date();
    }
    return;
  }
  await q("UPDATE users SET display_name=$2, is_customer=$3, updated_at=now() WHERE id=$1", [user.id, n, asCustomer]);
}

export async function submitAppeal(user: SessionUser, message: string) {
  await rateLimit(`appeal:${user.id}`, 3, 86400);
  const m = message.trim();
  if (m.length < 10 || m.length > 1500) throw new AppError("Please write 10–1500 characters.");
  if (!(await isPostgresAvailable())) {
    store.createReport(user.id, "user", user.id, "appeal", m);
    store.audit(user.id, "appeal.submitted", "user", user.id);
    return;
  }
  await q("INSERT INTO appeals (user_id, message) VALUES ($1,$2)", [user.id, m]);
  await audit(user.id, "appeal.submitted", "user", user.id);
}

/**
 * Account deletion = anonymisation. Blocked while a booking is active. Removes phone, name,
 * identity documents, photos and exact addresses. Bookings/reviews/audit rows are retained with
 * no personal identifiers (operators may need them for disputes and legal obligations).
 */
export async function deleteAccount(user: SessionUser): Promise<{ ok: boolean; message: string }> {
  if (!(await isPostgresAvailable())) {
    for (const bk of store.bookings.values()) {
      if ((bk.customer_id === user.id || bk.worker_id === user.id) &&
          ["awarded", "in_progress", "completion_requested", "disputed"].includes(bk.status)) {
        return { ok: false, message: "You have an active booking. Finish or cancel it first, then request deletion again." };
      }
    }
    const u = store.users.get(user.id);
    if (u) {
      u.deleted_at = new Date();
      u.phone = `deleted:${user.id}`;
      u.display_name = null;
    }
    for (const [k, s] of store.sessions.entries()) {
      if (s.user_id === user.id) store.sessions.delete(k);
    }
    await logout();
    return { ok: true, message: "Your account has been deleted." };
  }

  const active = await one(
    `SELECT 1 FROM bookings WHERE (customer_id=$1 OR worker_id=$1) AND status IN ('awarded','in_progress','completion_requested','disputed')`, [user.id]);
  if (active) {
    await q("INSERT INTO deletion_requests (user_id, status) VALUES ($1,'blocked_active_booking')", [user.id]);
    return { ok: false, message: "You have an active booking. Finish or cancel it first, then request deletion again." };
  }
  const files = await tx(async (c) => {
    const keys: string[] = [];
    for (const r of await q<{ k: string }>("SELECT storage_key k FROM identity_documents WHERE user_id=$1 AND storage_key IS NOT NULL", [user.id], c)) keys.push(r.k);
    for (const r of await q<{ k: string }>("SELECT storage_key k FROM worker_photos WHERE user_id=$1", [user.id], c)) keys.push(r.k);
    for (const r of await q<{ k: string }>("SELECT storage_key k FROM job_photos WHERE owner_id=$1", [user.id], c)) keys.push(r.k);
    await q("UPDATE identity_documents SET storage_key=NULL, deleted_at=now() WHERE user_id=$1 AND deleted_at IS NULL", [user.id], c);
    await q("DELETE FROM worker_photos WHERE user_id=$1", [user.id], c);
    await q("DELETE FROM job_photos WHERE owner_id=$1", [user.id], c);
    await q("DELETE FROM job_private WHERE job_id IN (SELECT id FROM jobs WHERE customer_id=$1)", [user.id], c);
    await q("UPDATE jobs SET status='cancelled', updated_at=now() WHERE customer_id=$1 AND status IN ('draft','open')", [user.id], c);
    await q("UPDATE bids SET status='withdrawn' WHERE worker_id=$1 AND status='active'", [user.id], c);
    await q("DELETE FROM worker_areas WHERE user_id=$1", [user.id], c);
    await q("DELETE FROM worker_categories WHERE user_id=$1", [user.id], c);
    await q("UPDATE worker_profiles SET bio='', accepting_bids=false WHERE user_id=$1", [user.id], c);
    await q("DELETE FROM notifications WHERE user_id=$1", [user.id], c);
    await q("DELETE FROM sessions WHERE user_id=$1", [user.id], c);
    await q(`UPDATE users SET phone = 'deleted:' || id::text, display_name = NULL, deleted_at = now(), updated_at = now(),
             notification_prefs = '{"in_app":false,"push":false,"sms":false}' WHERE id=$1`, [user.id], c);
    await q("INSERT INTO deletion_requests (user_id, status) VALUES ($1,'completed')", [user.id], c);
    await audit(user.id, "account.deleted", "user", user.id, {}, c);
    return keys;
  });
  for (const k of files) await deletePrivate(k);
  await logout();
  return { ok: true, message: "Your account has been deleted." };
}
