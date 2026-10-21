"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  requestOtp, verifyOtp, logout, requireUser, requireActive, requireWorker, requireAdmin, loginAsDemoUser,
} from "@/lib/auth";
import { AppError } from "@/lib/state";
import { DEMO_ACCOUNTS, demoAccountsEnabled } from "@/lib/config";
import { normalizePkPhone } from "@/lib/phone";
import { reportError } from "@/lib/logger";
import { createDraft, publishJob, cancelJob, createAndPublishJob } from "@/lib/jobs";
import { submitBid, withdrawBid, acceptBid } from "@/lib/bids";
import { progress, reportProblem, Action } from "@/lib/bookings";
import { submitReview, createReport } from "@/lib/reviews";
import {
  saveWorkerProfile, addWorkerPhoto, removeWorkerPhoto, submitIdentity, updateNotificationPrefs,
  updateDisplayName, submitAppeal, deleteAccount,
} from "@/lib/account";
import { moderate, addReportNote, closeAppeal, decideIdentity, updateSettings, adminExpandJob } from "@/lib/admin";
import { q, isPostgresAvailable } from "@/lib/db";
import { store } from "@/lib/store";
import { collectSignup, collectJobLead, collectBidActivity } from "@/lib/supabase";

export type FormState = { error?: string; ok?: string; devCode?: string; phone?: string; jobId?: string } | null;

/** Converts expected AppErrors to form messages; lets Next redirect/notFound signals through. */
async function wrap(fn: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await fn()) ?? null;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
    reportError(e, { where: "server_action" });
    return { error: "Something went wrong. Please try again." };
  }
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

// ---------- auth ----------
export async function requestOtpAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const r = await requestOtp(str(f, "phone"));
    return { phone: r.phone, devCode: r.devCode, ok: "Code sent." };
  });
}

export async function signUpAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const name = str(f, "name").trim();
    const phone = str(f, "phone").trim();
    const role = str(f, "role").trim() === "worker" ? "technician" : "customer";
    const trade = str(f, "trade").trim();
    const area = str(f, "area").trim();

    if (!name || name.length < 2) {
      throw new AppError("Please enter your real full name.");
    }
    if (!phone) {
      throw new AppError("Please enter your Pakistani mobile number.");
    }

    const r = await requestOtp(phone);

    // Collect lead/signup in Supabase
    await collectSignup({ name, phone: r.phone, role, trade, area });

    return { phone: r.phone, devCode: r.devCode, ok: "Verification code sent to your mobile." };
  });
}

export async function verifyOtpAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await verifyOtp(str(f, "phone"), str(f, "code"));

    // If registration metadata was provided, initialize user profile
    const name = str(f, "name").trim();
    if (name) {
      try {
        const u = await requireUser();
        await updateDisplayName(u, name);
        if (str(f, "role") === "worker") {
          const profileFd = new FormData();
          profileFd.set("bio", `${name} · Independent Technician in Lahore`);
          profileFd.set("experience_years", "3");
          profileFd.set("accepting_bids", "on");
          const trade = str(f, "trade");
          if (trade === "electrical") {
            profileFd.append("categories", "2");
          } else if (trade === "both") {
            profileFd.append("categories", "1");
            profileFd.append("categories", "2");
          } else {
            profileFd.append("categories", "1");
          }
          await saveWorkerProfile(u, profileFd);
        }
      } catch {
        // Non-blocking
      }
    }

    revalidatePath("/", "layout");
    redirect("/");
  });
}
export async function switchDemoUserAction(phone: string): Promise<FormState> {
  return wrap(async () => {
    const normalized = normalizePkPhone(String(phone ?? ""));
    const allowed = DEMO_ACCOUNTS.some((d) => normalizePkPhone(d.phone) === normalized);
    if (!demoAccountsEnabled() || !normalized || !allowed) {
      throw new AppError("Demo sign-in isn't available.", "forbidden");
    }
    await loginAsDemoUser(phone);
    revalidatePath("/", "layout");
    return { ok: "Demo session active." };
  });
}
export async function logoutAction() {
  await logout();
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- account ----------
export async function saveNameAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireUser();
    await updateDisplayName(u, str(f, "displayName"));
    revalidatePath("/", "layout");
    if (f.get("setup")) redirect("/dashboard");
    return { ok: "Saved." };
  });
}
export async function prefsAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await updateNotificationPrefs(await requireUser(), f.get("in_app") === "on");
    return { ok: "Saved." };
  });
}
export async function appealAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await submitAppeal(await requireUser(), str(f, "message"));
    return { ok: "Your appeal was sent. A moderator will review it." };
  });
}
export async function deleteAccountAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireUser();
    if (str(f, "confirm") !== "DELETE") throw new AppError("Type DELETE to confirm.");
    const r = await deleteAccount(u);
    if (!r.ok) return { error: r.message };
    redirect("/?deleted=1");
  });
}

// ---------- jobs ----------
export async function createJobAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    const id = await createDraft(u, f);
    redirect(`/jobs/${id}/preview`);
  });
}
export async function publishJobAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await publishJob(u, str(f, "jobId"));
    redirect(`/jobs/${str(f, "jobId")}`);
  });
}
export async function createAndPublishJobAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    const id = await createAndPublishJob(u, f);
    try {
      await collectJobLead({
        title: str(f, "title"),
        description: str(f, "description"),
        category: str(f, "categoryId") === "2" ? "Electrical" : "Plumbing",
        area: str(f, "areaId"),
        budgetMin: Number(f.get("budgetMin")) || null,
        budgetMax: Number(f.get("budgetMax")) || null,
        customerPhone: u.phone,
        addressText: str(f, "addressText"),
      });
    } catch {
      // Non-blocking
    }
    revalidatePath("/", "layout");
    return { ok: "Job posted and published successfully to Lahore technicians!", jobId: id };
  });
}
export async function cancelJobAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await cancelJob(u, str(f, "jobId"));
    redirect("/dashboard");
  });
}

// ---------- bids ----------
export async function submitBidAction(jobId: string, _: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireWorker();
    await submitBid(u, jobId, f);
    try {
      await collectBidActivity({
        jobId,
        workerPhone: u.phone,
        amount: Number(f.get("amount")) || 0,
        timingText: str(f, "timingText"),
        message: str(f, "message"),
      });
    } catch {
      // Non-blocking
    }
    revalidatePath(`/jobs/${jobId}`);
    return { ok: "Your bid was saved. You can edit or withdraw it until the customer chooses." };
  });
}
export async function withdrawBidAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireWorker();
    await withdrawBid(u, str(f, "bidId"));
    revalidatePath("/dashboard");
    revalidatePath(`/jobs/${str(f, "jobId")}`);
    return { ok: "Bid withdrawn." };
  });
}
export async function acceptBidAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await acceptBid(u, str(f, "bidId"), str(f, "exactAddress") || undefined);
    revalidatePath("/", "layout");
    redirect(`/jobs/${str(f, "jobId")}`);
  });
}

// ---------- booking progress ----------
export async function progressAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await progress(u, str(f, "bookingId"), str(f, "action") as Action, str(f, "code"));
    revalidatePath(`/jobs/${str(f, "jobId")}`);
    return { ok: "Updated." };
  });
}
export async function reportProblemAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await reportProblem(u, str(f, "bookingId"), str(f, "details"));
    revalidatePath(`/jobs/${str(f, "jobId")}`);
    return { ok: "Reported. The booking is marked disputed and will be reviewed." };
  });
}
export async function reviewAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await submitReview(u, str(f, "bookingId"), f);
    revalidatePath(`/jobs/${str(f, "jobId")}`);
    return { ok: "Review submitted. It becomes visible when both sides have reviewed, or after 7 days." };
  });
}
export async function reportAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await createReport(u, f);
    return { ok: "Thanks. Your report was sent to our moderators." };
  });
}

// ---------- worker ----------
export async function saveWorkerAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireActive();
    await saveWorkerProfile(u, f);
    revalidatePath("/", "layout");
    return { ok: "Profile saved." };
  });
}
export async function workerPhotoAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireWorker();
    const file = f.get("photo") as File | null;
    if (!file?.size) throw new AppError("Choose a photo.");
    await addWorkerPhoto(u, file);
    revalidatePath("/worker/profile");
    return { ok: "Photo added." };
  });
}
export async function removeWorkerPhotoAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await removeWorkerPhoto(await requireWorker(), str(f, "id"));
    revalidatePath("/worker/profile");
  });
}
export async function identityAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const u = await requireWorker();
    await submitIdentity(u, f);
    revalidatePath("/worker/profile");
    return { ok: "Submitted for manual review. This is not a NADRA check." };
  });
}
export async function markReadAction(_?: FormState): Promise<FormState> {
  return wrap(async () => {
    const u = await requireUser();
    if (!(await isPostgresAvailable())) {
      store.markNotificationsRead(u.id);
    } else {
      await q("UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL", [u.id]);
    }
    revalidatePath("/", "layout");
    return { ok: "Marked all as read." };
  });
}

// ---------- admin (each re-checks admin role server-side) ----------
export async function moderateAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await moderate(await requireAdmin(), f);
    revalidatePath("/admin");
    return { ok: "Action recorded." };
  });
}
export async function reportNoteAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await addReportNote(await requireAdmin(), str(f, "reportId"), str(f, "note"));
    revalidatePath("/admin");
    return { ok: "Note added." };
  });
}
export async function appealCloseAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await closeAppeal(await requireAdmin(), str(f, "id"));
    revalidatePath("/admin");
  });
}
export async function identityDecisionAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    const a = await requireAdmin();
    const reason = str(f, "reason").trim();
    if (reason.length < 5) throw new AppError("A reason is required.");
    const d = str(f, "decision");
    if (!["verified", "rejected", "needs_resubmission"].includes(d)) throw new AppError("Invalid decision.");
    await decideIdentity(a, str(f, "userId"), d as "verified", reason);
    revalidatePath("/admin");
    return { ok: "Decision recorded." };
  });
}
export async function settingsAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await updateSettings(await requireAdmin(), f);
    revalidatePath("/admin");
    return { ok: "Settings saved." };
  });
}
export async function expandJobAction(_: FormState, f: FormData): Promise<FormState> {
  return wrap(async () => {
    await adminExpandJob(await requireAdmin(), str(f, "jobId"));
    revalidatePath("/admin");
    return { ok: "Matching widened and new workers notified." };
  });
}
