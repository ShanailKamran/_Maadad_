/**
 * Central configuration. Everything environment-driven is read here so that safety rules
 * (e.g. dev OTP never in production) live in exactly one place.
 */
const env = process.env;

export const appName = env.NEXT_PUBLIC_APP_NAME || "مدد (Maddad)";
export const isProd = env.NODE_ENV === "production";
export const appUrl = env.APP_URL || "http://localhost:3000";
export const supportEmail = env.SUPPORT_EMAIL || "";

export const TIMEZONE = "Asia/Karachi";
export const ACTIVE_CITY_SLUG = "lahore";

function isLocalUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Dev OTP shows the code on screen. It is enabled only when ALL are true:
 * explicit flag, non-production build, and APP_URL pointing at localhost.
 */
export function devOtpEnabled(): boolean {
  return env.ENABLE_DEV_OTP === "true" && !isProd && isLocalUrl(appUrl);
}

/** Fictional pilot personas. Only these numbers can ever use one-click demo sign-in. */
export const DEMO_ACCOUNTS = [
  { phone: "0300 1112233", name: "Tariq (demo customer)", role: "Customer", blurb: "Post jobs and compare bids" },
  { phone: "0300 4445566", name: "Rashid (demo electrician)", role: "Technician", blurb: "Browse and bid on electrical jobs" },
  { phone: "0300 7778899", name: "Akram (demo plumber)", role: "Technician", blurb: "Browse and bid on plumbing jobs" },
  { phone: "0300 1234567", name: "Fatima (demo moderator)", role: "Moderator", blurb: "Review the reports queue" },
] as const;

/**
 * One-click demo accounts are available in development, or in production only when
 * ENABLE_DEMO_ACCOUNTS=true is set explicitly (for a clearly-labelled pilot).
 */
export function demoAccountsEnabled(): boolean {
  return !isProd || env.ENABLE_DEMO_ACCOUNTS === "true";
}

export function sessionSecret(): string {
  const s = env.SESSION_SECRET || "";
  if (s.length < 32) {
    if (isProd) throw new Error("SESSION_SECRET must be set (>= 32 chars) in production.");
    // Development fallback only; random per process so nothing predictable is persisted.
    return (globalThis as { __devSecret?: string }).__devSecret ??=
      Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return s;
}

export const adminPhones = (env.ADMIN_PHONES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export type IdentityPolicy = "open" | "pending_ok" | "verified_only";

export const defaults = {
  identityPolicy: (env.DEFAULT_IDENTITY_POLICY || "pending_ok") as IdentityPolicy,
  matchRadiusKm: Number(env.DEFAULT_MATCH_RADIUS_KM || 3),
  jobExpiryDays: Number(env.DEFAULT_JOB_EXPIRY_DAYS || 7),
  minBidsTarget: Number(env.DEFAULT_MIN_BIDS_TARGET || 3),
  expandAfterHours: Number(env.DEFAULT_EXPAND_AFTER_HOURS || 6),
};

export const storage = {
  driver: env.STORAGE_DRIVER || "local",
  localDir: env.STORAGE_LOCAL_DIR || "./storage-private",
  identityRetentionDays: Number(env.IDENTITY_RETENTION_DAYS || 30),
};

/**
 * Identity uploads are possible ONLY with the local private driver outside production,
 * because no production-grade private object store is implemented in this MVP.
 */
export function identityUploadEnabled(): boolean {
  if (storage.driver === "supabase") return env.ENABLE_IDENTITY_UPLOAD === "true";
  return env.ENABLE_IDENTITY_UPLOAD === "true" && !isProd && storage.driver === "local";
}

export function photoUploadEnabled(): boolean {
  if (storage.driver === "supabase") return true;
  if (storage.driver !== "local") return false;
  return !isProd || env.ALLOW_LOCAL_PHOTO_STORAGE_IN_PROD === "true";
}

export const cronSecret = env.CRON_SECRET || "";

export const reviewRevealDays = 7;
export const MAX_PHOTO_BYTES = 1_500_000; // 1.5 MB each, low-bandwidth friendly
export const MAX_PHOTOS_PER_JOB = 3;
export const MAX_WORKER_PHOTOS = 4;
