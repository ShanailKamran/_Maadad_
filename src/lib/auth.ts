import { createHmac, randomBytes, randomInt, timingSafeEqual, createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { cache } from "react";
import { one, q, tx, isPostgresAvailable } from "./db";
import { adminPhones, isProd, sessionSecret } from "./config";
import { getOtpProvider } from "./otp/provider";
import { rateLimit } from "./ratelimit";
import { normalizePkPhone } from "./phone";
import { AppError } from "./state";
import { audit } from "./audit";
import { store } from "./store";

const COOKIE = "kl_session";
const SESSION_DAYS = 30;
const OTP_TTL_MIN = 5;

export type SessionUser = {
  id: string;
  phone: string;
  display_name: string | null;
  is_customer: boolean;
  is_worker: boolean;
  is_admin: boolean;
  account_status: "active" | "suspended" | "banned";
  status_reason: string | null;
  suspended_until: Date | null;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (s: string) => createHmac("sha256", sessionSecret()).update(s).digest("hex");

function clientIp(): string {
  try {
    const h = headers();
    return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
  } catch {
    return "unknown";
  }
}

export async function requestOtp(rawPhone: string): Promise<{ phone: string; devCode?: string }> {
  const phone = normalizePkPhone(rawPhone);
  if (!phone) throw new AppError("Enter a valid Pakistani mobile number, e.g. 0300 1234567.");
  const provider = getOtpProvider();
  if (!provider) {
    throw new AppError(
      isProd
        ? "Sign-in is not available yet: no SMS provider is configured for this deployment."
        : "No OTP provider is enabled. Set ENABLE_DEV_OTP=true for local development.",
    );
  }
  await rateLimit(`otp_req_phone:${phone}`, 3, 600);
  await rateLimit(`otp_req_ip:${clientIp()}`, 10, 600);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  if (!(await isPostgresAvailable())) {
    store.recordOtp(phone, hmac(phone + ":" + code), OTP_TTL_MIN);
    const res = await provider.send(phone, code);
    return { phone, devCode: res.devCode };
  }

  await q(
    `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' minutes')::interval)`,
    [phone, hmac(phone + ":" + code), String(OTP_TTL_MIN)],
  );
  const res = await provider.send(phone, code);
  return { phone, devCode: res.devCode };
}

export async function verifyOtp(rawPhone: string, code: string): Promise<void> {
  const phone = normalizePkPhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(code)) throw new AppError("Enter the 6-digit code.");
  await rateLimit(`otp_verify_phone:${phone}`, 8, 600);
  await rateLimit(`otp_verify_ip:${clientIp()}`, 30, 600);

  if (!(await isPostgresAvailable())) {
    const userId = store.consumeOtp(phone, code, (raw) => hmac(raw));
    if (adminPhones.includes(phone)) {
      const u = store.getUserById(userId);
      if (u) {
        u.is_admin = true;
        store.users.set(userId, u);
      }
    }
    const token = randomBytes(32).toString("hex");
    store.saveSession(userId, sha256(token), SESSION_DAYS);
    cookies().set(COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86400,
    });
    return;
  }

  const row = await one<{ id: string; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM otp_codes
     WHERE phone=$1 AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone],
  );
  if (!row || row.attempts >= 5) throw new AppError("That code has expired. Request a new one.");
  await q("UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1", [row.id]);

  const a = Buffer.from(row.code_hash);
  const b = Buffer.from(hmac(phone + ":" + code));
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("Incorrect code.");

  const userId = await tx(async (c) => {
    await q("UPDATE otp_codes SET consumed_at=now() WHERE id=$1", [row.id], c);
    let u = await one<{ id: string }>("SELECT id FROM users WHERE phone=$1 AND deleted_at IS NULL", [phone], c);
    if (!u) {
      u = await one<{ id: string }>(
        `INSERT INTO users (phone, phone_verified_at) VALUES ($1, now()) RETURNING id`,
        [phone],
        c,
      );
      await audit(u!.id, "user.created", "user", u!.id, {}, c);
    } else {
      await q("UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, now()), updated_at=now() WHERE id=$1", [u.id], c);
    }
    if (adminPhones.includes(phone)) await q("UPDATE users SET is_admin=true WHERE id=$1", [u!.id], c);
    return u!.id;
  });

  const token = randomBytes(32).toString("hex");
  await q(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)`,
    [userId, sha256(token), String(SESSION_DAYS)],
  );
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function loginAsDemoUser(rawPhone: string): Promise<SessionUser> {
  const phone = normalizePkPhone(rawPhone);
  if (!phone) throw new AppError("Invalid phone number.");

  if (!(await isPostgresAvailable())) {
    let u = store.getUserByPhone(phone);
    if (!u) {
      const newId = `u-${Date.now()}-${randomBytes(4).toString("hex")}`;
      const now = new Date();
      u = {
        id: newId,
        phone,
        phone_verified_at: now,
        display_name: null,
        is_customer: true,
        is_worker: false,
        is_admin: adminPhones.includes(phone),
        account_status: "active",
        status_reason: null,
        suspended_until: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      store.users.set(newId, u);
    }
    if (adminPhones.includes(phone)) {
      u.is_admin = true;
    }
    const token = randomBytes(32).toString("hex");
    store.saveSession(u.id, sha256(token), SESSION_DAYS);
    cookies().set(COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86400,
    });
    return {
      id: u.id,
      phone: u.phone,
      display_name: u.display_name,
      is_customer: u.is_customer,
      is_worker: u.is_worker,
      is_admin: u.is_admin,
      account_status: u.account_status,
      status_reason: u.status_reason,
      suspended_until: u.suspended_until,
    };
  }

  let dbUser = await one<{ id: string }>("SELECT id FROM users WHERE phone=$1 AND deleted_at IS NULL", [phone]);
  if (!dbUser) {
    dbUser = await one<{ id: string }>(
      `INSERT INTO users (phone, phone_verified_at) VALUES ($1, now()) RETURNING id`,
      [phone],
    );
  }
  if (adminPhones.includes(phone)) {
    await q("UPDATE users SET is_admin=true WHERE id=$1", [dbUser!.id]);
  }
  const token = randomBytes(32).toString("hex");
  await q(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)`,
    [dbUser!.id, sha256(token), String(SESSION_DAYS)],
  );
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });

  const refreshed = await getUser();
  if (!refreshed) throw new AppError("Failed to initialize session.");
  return refreshed;
}

export async function logout(): Promise<void> {
  const t = cookies().get(COOKIE)?.value;
  if (t) {
    if (!(await isPostgresAvailable())) {
      store.deleteSession(sha256(t));
    } else {
      await q("DELETE FROM sessions WHERE token_hash=$1", [sha256(t)]);
    }
  }
  cookies().delete(COOKIE);
}

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;

  if (!(await isPostgresAvailable())) {
    const u = store.getUserBySession(sha256(t));
    if (!u) return null;
    return {
      id: u.id,
      phone: u.phone,
      display_name: u.display_name,
      is_customer: u.is_customer,
      is_worker: u.is_worker,
      is_admin: u.is_admin,
      account_status: u.account_status,
      status_reason: u.status_reason,
      suspended_until: u.suspended_until,
    };
  }

  const u = await one<SessionUser>(
    `SELECT u.id, u.phone, u.display_name, u.is_customer, u.is_worker, u.is_admin,
            u.account_status, u.status_reason, u.suspended_until
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash=$1 AND s.expires_at > now() AND u.deleted_at IS NULL`,
    [sha256(t)],
  );
  if (!u) return null;
  // Temporary suspensions lapse automatically; bans never do.
  if (u.account_status === "suspended" && u.suspended_until && u.suspended_until < new Date()) {
    await q("UPDATE users SET account_status='active', status_reason=NULL, suspended_until=NULL WHERE id=$1", [u.id]);
    await audit(null, "user.suspension_lapsed", "user", u.id);
    u.account_status = "active";
  }
  return u;
});

/** For pages: any signed-in user (even restricted ones, who can still read/appeal). */
export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

/** For mutations that create content or contact others: blocks suspended/banned accounts. */
export async function requireActive(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.account_status !== "active") {
    throw new AppError("Your account is restricted. You can't do this. See your account page to appeal.", "forbidden");
  }
  if (!u.display_name) redirect("/account?setup=1");
  return u;
}

export async function requireWorker(): Promise<SessionUser> {
  const u = await requireActive();
  if (!u.is_worker) throw new AppError("Create a worker profile first.", "forbidden");
  return u;
}

/** Admin pages 404 for non-admins so their existence isn't advertised. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await getUser();
  if (!u || !u.is_admin || u.account_status !== "active") notFound();
  return u;
}
