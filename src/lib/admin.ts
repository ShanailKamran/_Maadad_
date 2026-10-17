import { q, one, tx, isPostgresAvailable } from "./db";
import { SessionUser } from "./auth";
import { AppError, JobStatus } from "./state";
import { audit } from "./audit";
import { notify } from "./notify";
import { logStatus } from "./jobs";
import { expandJob } from "./matching";
import { deletePrivate, getPrivate } from "./storage";
import { storage } from "./config";
import { setSetting } from "./settings";
import { log } from "./logger";
import { store } from "./store";

const reasonOf = (r: FormDataEntryValue | null): string => {
  const s = String(r ?? "").trim();
  if (s.length < 5) throw new AppError("A reason of at least 5 characters is required for moderation actions.");
  return s.slice(0, 1000);
};

export type ModAction =
  | "warn" | "suspend" | "ban" | "reinstate" | "dismiss_report"
  | "hide_job" | "unhide_job" | "hide_review" | "unhide_review" | "hide_bid"
  | "resolve_complete" | "resolve_cancel";

/** Every action requires a reason, is written to moderation_actions AND audit_logs. */
export async function moderate(admin: SessionUser, form: FormData): Promise<void> {
  const action = String(form.get("action")) as ModAction;
  const targetType = String(form.get("targetType")) as "user" | "job" | "review" | "bid" | "booking";
  const targetId = String(form.get("targetId"));
  const reportId = (form.get("reportId") as string) || undefined;
  const reason = reasonOf(form.get("reason"));
  const days = Number(form.get("days") || 0);

  if (!(await isPostgresAvailable())) {
    store.moderate(admin.id, action, targetType, targetId, reportId, reason, days);
    return;
  }

  if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new AppError("Invalid target.");

  await tx(async (c) => {
    let logged: string = action;
    if (["warn", "suspend", "ban", "reinstate"].includes(action)) {
      const t = await one<{ is_admin: boolean }>("SELECT is_admin FROM users WHERE id=$1 FOR UPDATE", [targetId], c);
      if (!t) throw new AppError("User not found.", "not_found");
      if (t.is_admin) throw new AppError("Admin accounts can't be actioned here.", "forbidden");
      if (targetId === admin.id) throw new AppError("You can't action your own account.", "forbidden");
      if (action === "warn") {
        await notify(targetId, "warning", "Warning from moderators", reason, undefined, c);
      } else if (action === "suspend") {
        if (!(days >= 1 && days <= 90)) throw new AppError("Suspension must be 1–90 days.");
        await q(`UPDATE users SET account_status='suspended', status_reason=$2, suspended_until=now() + ($3 || ' days')::interval, updated_at=now() WHERE id=$1`, [targetId, reason, String(days)], c);
        await q("DELETE FROM sessions WHERE user_id=$1", [targetId], c);
      } else if (action === "ban") {
        await q(`UPDATE users SET account_status='banned', status_reason=$2, suspended_until=NULL, updated_at=now() WHERE id=$1`, [targetId, reason], c);
        await q("DELETE FROM sessions WHERE user_id=$1", [targetId], c);
        await q(`UPDATE bids SET status='withdrawn', updated_at=now() WHERE worker_id=$1 AND status='active'`, [targetId], c);
      } else {
        await q(`UPDATE users SET account_status='active', status_reason=NULL, suspended_until=NULL, updated_at=now() WHERE id=$1`, [targetId], c);
      }
    } else if (action === "hide_job" || action === "unhide_job") {
      await q("UPDATE jobs SET hidden_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$1", [targetId, action === "hide_job"], c);
    } else if (action === "hide_review" || action === "unhide_review") {
      await q("UPDATE reviews SET status=$2, hidden_reason=$3 WHERE id=$1", [targetId, action === "hide_review" ? "hidden" : "visible", reason], c);
    } else if (action === "hide_bid") {
      await q("UPDATE bids SET hidden_at=now() WHERE id=$1", [targetId], c);
    } else if (action === "resolve_complete" || action === "resolve_cancel") {
      // Dispute resolution only records status. It does NOT refund, withhold or move money.
      const b = await one<{ id: string; job_id: string; status: JobStatus }>("SELECT id, job_id, status FROM bookings WHERE id=$1 FOR UPDATE", [targetId], c);
      if (!b || b.status !== "disputed") throw new AppError("Only disputed bookings can be resolved.");
      const to: JobStatus = action === "resolve_complete" ? "completed" : "cancelled";
      await q(`UPDATE bookings SET status=$2, completed_at = CASE WHEN $2='completed' THEN now() ELSE completed_at END WHERE id=$1`, [b.id, to], c);
      await q("UPDATE jobs SET status=$2, updated_at=now() WHERE id=$1", [b.job_id, to], c);
      await logStatus(c, b.job_id, "disputed", to, admin.id, "admin dispute resolution");
      logged = "resolve_dispute";
    } else if (action !== "dismiss_report") throw new AppError("Unknown action.");

    await q(`INSERT INTO moderation_actions (admin_id, target_type, target_id, report_id, action, reason) VALUES ($1,$2,$3,$4,$5,$6)`,
      [admin.id, targetType, targetId, reportId ?? null, logged === "resolve_dispute" ? "resolve_dispute" : action, reason], c);
    if (reportId) {
      await q(`UPDATE reports SET status=$2, resolved_by=$3, resolved_at=now(), internal_notes = COALESCE(internal_notes || E'\\n', '') || $4 WHERE id=$1`,
        [reportId, action === "dismiss_report" ? "dismissed" : "actioned", admin.id, reason], c);
    }
    await audit(admin.id, `moderation.${action}`, targetType, targetId, { reportId }, c);
  });
}

export async function addReportNote(admin: SessionUser, reportId: string, note: string) {
  if (note.trim().length < 2) throw new AppError("Note is empty.");
  if (!(await isPostgresAvailable())) {
    store.addReportNote(admin.id, reportId, note);
    return;
  }
  await q(`UPDATE reports SET internal_notes = COALESCE(internal_notes || E'\\n', '') || $2 WHERE id=$1`, [reportId, `[${admin.display_name ?? "admin"}] ${note.trim().slice(0, 1000)}`]);
  await audit(admin.id, "report.note_added", "report", reportId);
}

export async function reportQueue(status = "open") {
  if (!(await isPostgresAvailable())) {
    return store.reportQueue(status);
  }
  return q<{ id: string; target_type: string; target_id: string; category: string; details: string | null; status: string; internal_notes: string | null; created_at: Date; reporter_name: string | null; target_label: string | null }>(
    `SELECT r.id, r.target_type, r.target_id, r.category, r.details, r.status, r.internal_notes, r.created_at, u.display_name AS reporter_name,
        CASE r.target_type
          WHEN 'user' THEN (SELECT COALESCE(display_name,'(no name)') FROM users WHERE id=r.target_id)
          WHEN 'job' THEN (SELECT title FROM jobs WHERE id=r.target_id)
          WHEN 'review' THEN (SELECT left(COALESCE(comment,'(no comment)'),120) FROM reviews WHERE id=r.target_id)
          WHEN 'bid' THEN (SELECT left(message,120) FROM bids WHERE id=r.target_id)
          WHEN 'booking' THEN (SELECT j.title FROM bookings b JOIN jobs j ON j.id=b.job_id WHERE b.id=r.target_id)
        END AS target_label
     FROM reports r JOIN users u ON u.id=r.reporter_id WHERE r.status=$1 ORDER BY r.created_at LIMIT 100`, [status]);
}

export async function moderationHistory() {
  if (!(await isPostgresAvailable())) {
    return store.getAuditLogs().map((a, i) => ({
      id: i + 1,
      action: a.action,
      target_type: a.target_type,
      target_id: a.target_id ?? "",
      reason: (a.metadata?.reason as string) || "System action",
      created_at: a.created_at,
      admin_name: a.actor_id ? (store.users.get(a.actor_id)?.display_name ?? "Moderator") : "System",
    }));
  }
  return q<{ id: number; action: string; target_type: string; target_id: string; reason: string; created_at: Date; admin_name: string | null }>(
    `SELECT m.id, m.action, m.target_type, m.target_id, m.reason, m.created_at, u.display_name AS admin_name
     FROM moderation_actions m JOIN users u ON u.id=m.admin_id ORDER BY m.created_at DESC LIMIT 100`);
}

export async function openAppeals() {
  if (!(await isPostgresAvailable())) {
    const out: any[] = [];
    for (const r of store.reports.values()) {
      if (r.category === "appeal" && r.status === "open") {
        const u = store.users.get(r.reporter_id);
        out.push({
          id: r.id,
          message: r.details ?? "",
          created_at: r.created_at,
          user_id: r.reporter_id,
          display_name: u?.display_name ?? null,
          account_status: u?.account_status ?? "active",
          status_reason: u?.status_reason ?? null,
        });
      }
    }
    return out;
  }
  return q<{ id: string; message: string; created_at: Date; user_id: string; display_name: string | null; account_status: string; status_reason: string | null }>(
    `SELECT a.id, a.message, a.created_at, a.user_id, u.display_name, u.account_status, u.status_reason
     FROM appeals a JOIN users u ON u.id=a.user_id WHERE a.status='open' ORDER BY a.created_at`);
}

export async function closeAppeal(admin: SessionUser, id: string) {
  if (!(await isPostgresAvailable())) {
    const r = store.reports.get(id);
    if (r) { r.status = "dismissed"; r.resolved_by = admin.id; }
    store.audit(admin.id, "appeal.closed", "appeal", id);
    return;
  }
  await q("UPDATE appeals SET status='closed' WHERE id=$1", [id]);
  await audit(admin.id, "appeal.closed", "appeal", id);
}

// ---------- Identity verification ----------
export async function identityQueue() {
  if (!(await isPostgresAvailable())) {
    return store.identityQueue().map(item => ({
      user_id: item.user_id,
      display_name: item.display_name,
      identity_status: "pending_review",
      docs: [
        { id: "doc-front", document_type: "cnic_front", submitted_at: item.created_at.toISOString(), deleted: false },
        { id: "doc-back", document_type: "cnic_back", submitted_at: item.created_at.toISOString(), deleted: false },
      ],
    }));
  }
  return q<{ user_id: string; display_name: string | null; identity_status: string; docs: { id: string; document_type: string; submitted_at: string; deleted: boolean }[] }>(
    `SELECT u.id AS user_id, u.display_name, wp.identity_status::text,
       COALESCE((SELECT json_agg(json_build_object('id', d.id, 'document_type', d.document_type, 'submitted_at', d.submitted_at, 'deleted', d.deleted_at IS NOT NULL) ORDER BY d.submitted_at)
                 FROM identity_documents d WHERE d.user_id=u.id AND d.deleted_at IS NULL),'[]') AS docs
     FROM worker_profiles wp JOIN users u ON u.id=wp.user_id WHERE wp.identity_status IN ('pending_review') ORDER BY u.created_at LIMIT 100`);
}

/** Stream a document to an admin for manual review. Every access is audit-logged (id only, no content). */
export async function readIdentityDocument(admin: SessionUser, docId: string): Promise<{ data: Buffer; mime: string }> {
  if (!(await isPostgresAvailable())) {
    return { data: Buffer.from("DEMO_ENCRYPTED_DOC"), mime: "image/jpeg" };
  }
  const d = await one<{ storage_key: string | null; mime_type: string; user_id: string }>(
    "SELECT storage_key, mime_type, user_id FROM identity_documents WHERE id=$1 AND deleted_at IS NULL", [docId]);
  if (!d || !d.storage_key) throw new AppError("Document not found.", "not_found");
  await audit(admin.id, "identity_document.accessed", "identity_document", docId, { subject: d.user_id });
  return { data: await getPrivate(d.storage_key), mime: d.mime_type };
}

/** Records the manual review outcome. Starts the retention clock for the raw documents. */
export async function decideIdentity(admin: SessionUser, userId: string, decision: "verified" | "rejected" | "needs_resubmission", reason: string) {
  if (!(await isPostgresAvailable())) {
    store.decideIdentity(admin.id, userId, decision, reason);
    return;
  }
  const actionMap = { verified: "verify_identity", rejected: "reject_identity", needs_resubmission: "request_resubmission" } as const;
  await tx(async (c) => {
    const r = await one("UPDATE worker_profiles SET identity_status=$2, updated_at=now() WHERE user_id=$1 RETURNING user_id", [userId, decision], c);
    if (!r) throw new AppError("Worker not found.", "not_found");
    await q(`UPDATE identity_documents SET status=$2, reviewed_at=now(), reviewed_by=$3, review_note=$4,
             delete_after = now() + ($5 || ' days')::interval WHERE user_id=$1 AND deleted_at IS NULL AND status='pending'`,
      [userId, decision === "verified" ? "accepted" : "rejected", admin.id, reason, String(storage.identityRetentionDays)], c);
    await q(`INSERT INTO moderation_actions (admin_id, target_type, target_id, action, reason) VALUES ($1,'user',$2,$3,$4)`, [admin.id, userId, actionMap[decision], reason], c);
    await audit(admin.id, `identity.${decision}`, "user", userId, {}, c);
    await notify(userId, "identity_update", "Identity review update",
      decision === "verified" ? "Your identity documents were reviewed and your profile shows 'ID reviewed'. This is not a guarantee of skill, safety or background."
        : decision === "rejected" ? "We couldn't accept your identity documents." : "Please resubmit clearer identity documents.", undefined, c);
  });
}

/** Secure deletion of identity files past retention (run by `npm run maintenance` / cron). */
export async function purgeIdentityDocuments(): Promise<number> {
  if (!(await isPostgresAvailable())) return 0;
  const rows = await q<{ id: string; storage_key: string }>(
    `SELECT id, storage_key FROM identity_documents WHERE deleted_at IS NULL AND storage_key IS NOT NULL AND delete_after IS NOT NULL AND delete_after <= now()`);
  for (const r of rows) {
    await deletePrivate(r.storage_key);
    await q("UPDATE identity_documents SET storage_key=NULL, deleted_at=now() WHERE id=$1", [r.id]);
    await audit(null, "identity_document.purged", "identity_document", r.id);
  }
  if (rows.length) log.info("identity_purged", { count: rows.length });
  return rows.length;
}

// ---------- Settings & matching ops ----------
export async function updateSettings(admin: SessionUser, form: FormData) {
  const policy = String(form.get("identity_policy"));
  if (!["open", "pending_ok", "verified_only"].includes(policy)) throw new AppError("Invalid identity policy.");
  const nums: [string, number, number][] = [["match_radius_km", 1, 30], ["job_expiry_days", 1, 30], ["min_bids_target", 1, 10], ["expand_after_hours", 1, 72]];
  await setSetting("identity_policy", policy, admin.id);
  for (const [k, lo, hi] of nums) {
    const n = Number(form.get(k));
    if (!(n >= lo && n <= hi)) throw new AppError(`${k} must be between ${lo} and ${hi}.`);
    await setSetting(k, String(n), admin.id);
  }
  await audit(admin.id, "settings.updated", "settings", "app", { policy });
}

export async function adminExpandJob(admin: SessionUser, jobId: string) {
  if (!(await isPostgresAvailable())) {
    const j = store.jobs.get(jobId);
    if (!j || j.status !== "open") throw new AppError("Job not open.");
    j.match_radius_km += 5;
    store.audit(admin.id, "job.expanded", "job", jobId);
    return;
  }
  const ok = await expandJob(jobId);
  if (!ok) throw new AppError("That job can't be expanded further (not open or at max radius).");
  await audit(admin.id, "job.expanded", "job", jobId);
}

export async function lowBidJobs() {
  if (!(await isPostgresAvailable())) {
    const out: any[] = [];
    for (const j of store.jobs.values()) {
      if (j.status === "open") {
        let bids = 0;
        for (const b of store.bids.values()) {
          if (b.job_id === j.id && b.status === "active") bids++;
        }
        out.push({
          id: j.id,
          title: j.title,
          category: store.getPublicJobs().find(pj => pj.id === j.id)?.category ?? "Service",
          area: store.getPublicJobs().find(pj => pj.id === j.id)?.area ?? "Lahore",
          match_stage: 0,
          match_radius_km: String(j.match_radius_km),
          bids,
          matched: 2,
          age_h: Math.floor((Date.now() - j.created_at.getTime()) / 3600000),
        });
      }
    }
    return out;
  }
  return q<{ id: string; title: string; category: string; area: string; bids: number; match_stage: number; match_radius_km: string; matched: number; age_h: number }>(
    `SELECT j.id, j.title, c.name AS category, a.name AS area, j.match_stage, j.match_radius_km::text,
        (SELECT count(*)::int FROM bids b WHERE b.job_id=j.id AND b.status='active') AS bids,
        (SELECT count(*)::int FROM match_events m WHERE m.job_id=j.id) AS matched,
        (extract(epoch from now() - j.published_at)/3600)::int AS age_h
     FROM jobs j JOIN service_categories c ON c.id=j.category_id JOIN service_areas a ON a.id=j.area_id
     WHERE j.status='open' ORDER BY j.published_at LIMIT 50`);
}
