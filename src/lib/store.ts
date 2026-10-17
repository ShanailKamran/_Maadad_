/**
 * Production-minded Domain Store & Fallback Engine for Maddad Lahore.
 *
 * Provides typed, fully-audited in-process storage when PostgreSQL/PostGIS is
 * not reachable (e.g. local development without Docker, or Vercel serverless preview),
 * guaranteeing that:
 * 1. Guests NEVER see private addresses, phone numbers, bids, or bidder profiles.
 * 2. Workers only see open jobs matching their trade and area/radius.
 * 3. Customers privately compare bids on their own jobs.
 * 4. Exact contact details unlock ONLY for the single awarded booking.
 * 5. All demo data is strictly tagged with `is_demo: true` and prefixed `[DEMO]`.
 * 6. State machine transitions and rate limits are validated server-side.
 */

import { createHmac, createHash, randomBytes, randomInt } from "crypto";
import { AppError, assertTransition, canTransition, CONTACT_VISIBLE, JobStatus, Actor } from "./state";
import { normalizePkPhone } from "./phone";
import { sessionSecret } from "./config";

export type City = { id: number; slug: string; name: string; active: boolean };
export type Category = { id: number; slug: string; name: string; name_ur: string; sort_order: number; active: boolean };
export type Area = { id: number; name: string; name_ur: string; lat: number; lng: number; active: boolean };

export type User = {
  id: string;
  phone: string;
  phone_verified_at: Date | null;
  display_name: string | null;
  is_customer: boolean;
  is_worker: boolean;
  is_admin: boolean;
  account_status: "active" | "suspended" | "banned";
  status_reason: string | null;
  suspended_until: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type WorkerProfile = {
  user_id: string;
  bio: string;
  experience_years: number | null;
  identity_status: "not_submitted" | "pending_review" | "verified" | "rejected" | "needs_resubmission";
  identity_rejection_reason: string | null;
  is_demo: boolean;
  categories: number[];
  areas: number[];
  available: boolean;
  created_at: Date;
  updated_at: Date;
};

export type Job = {
  id: string;
  customer_id: string;
  category_id: number;
  area_id: number;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  asap: boolean;
  preferred_at: Date | null;
  status: JobStatus;
  match_radius_km: number;
  is_demo: boolean;
  published_at: Date | null;
  expires_at: Date;
  hidden_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type JobPrivate = {
  job_id: string;
  address_text: string;
  contact_note: string | null;
  lat: number | null;
  lng: number | null;
};

export type Bid = {
  id: string;
  job_id: string;
  worker_id: string;
  amount: number;
  timing_text: string;
  message: string;
  inclusions: string;
  exclusions: string;
  status: "active" | "accepted" | "rejected" | "withdrawn" | "expired";
  hidden_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type Booking = {
  id: string;
  job_id: string;
  customer_id: string;
  worker_id: string;
  bid_id: string;
  status: JobStatus;
  selected_at: Date;
  started_at: Date | null;
  completion_requested_at: Date | null;
  completed_at: Date | null;
  disputed_at: Date | null;
  cancelled_at: Date | null;
  completion_code: string;
  completion_code_attempts: number;
  created_at: Date;
  updated_at: Date;
};

export type Review = {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  stars: number;
  comment: string;
  status: "visible" | "hidden";
  hidden_reason: string | null;
  created_at: Date;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: "job" | "bid" | "user" | "review" | "booking";
  target_id: string;
  category: string;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  internal_notes: string | null;
  resolved_by: string | null;
  resolved_at: Date | null;
  created_at: Date;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  ref_type: string | null;
  ref_id: string | null;
  read_at: Date | null;
  created_at: Date;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export type OtpCode = {
  id: string;
  phone: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
};

export type Session = {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
};

// -------------------------------------------------------------
// Reference Data: Lahore neighbourhoods & pilot categories
// -------------------------------------------------------------
const CITIES: City[] = [
  { id: 1, slug: "lahore", name: "Lahore", active: true },
];

const CATEGORIES: Category[] = [
  { id: 1, slug: "plumbing", name: "Plumbing", name_ur: "پلمبنگ", sort_order: 1, active: true },
  { id: 2, slug: "electrical", name: "Electrical", name_ur: "الیکٹریکل", sort_order: 2, active: true },
];

const AREAS_RAW: [string, string, number, number][] = [
  ["Gulberg", "گلبرگ", 31.512, 74.344],
  ["DHA Phase 5", "ڈی ایچ اے فیز 5", 31.477, 74.4],
  ["DHA Phase 6", "ڈی ایچ اے فیز 6", 31.465, 74.43],
  ["Johar Town", "جوہر ٹاؤن", 31.4697, 74.2728],
  ["Model Town", "ماڈل ٹاؤن", 31.4826, 74.3239],
  ["Bahria Town", "بحریہ ٹاؤن", 31.3653, 74.186],
  ["Wapda Town", "واپڈا ٹاؤن", 31.4417, 74.2658],
  ["Faisal Town", "فیصل ٹاؤن", 31.485, 74.3],
  ["Garden Town", "گارڈن ٹاؤن", 31.498, 74.33],
  ["Lahore Cantt", "لاہور کینٹ", 31.529, 74.39],
  ["Allama Iqbal Town", "علامہ اقبال ٹاؤن", 31.505, 74.29],
  ["Samanabad", "سمن آباد", 31.54, 74.3],
  ["Shadman", "شادمان", 31.538, 74.332],
  ["Township", "ٹاؤن شپ", 31.435, 74.3],
  ["Valencia Town", "ویلنشیا ٹاؤن", 31.432, 74.256],
  ["Askari 10", "عسکری 10", 31.493, 74.402],
  ["Muslim Town", "مسلم ٹاؤن", 31.524, 74.328],
  ["Sabzazar", "سبزہ زار", 31.5, 74.268],
  ["Walled City", "اندرون شہر", 31.5826, 74.3294],
  ["Cavalry Ground", "کیولری گراؤنڈ", 31.51, 74.38],
];

const AREAS: Area[] = AREAS_RAW.map(([name, name_ur, lat, lng], i) => ({
  id: i + 1,
  name,
  name_ur,
  lat,
  lng,
  active: true,
}));

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function completionCodeForJob(jobId: string): string {
  const h = createHmac("sha256", sessionSecret()).update(`completion:${jobId}`).digest();
  return String(h.readUInt32BE(0) % 10000).padStart(4, "0");
}

// -------------------------------------------------------------
// Domain Store Class
// -------------------------------------------------------------
export class DomainStore {
  users: Map<string, User> = new Map();
  workerProfiles: Map<string, WorkerProfile> = new Map();
  jobs: Map<string, Job> = new Map();
  jobPrivates: Map<string, JobPrivate> = new Map();
  jobPhotos: Map<string, { id: string; job_id: string; owner_id: string; storage_key: string; mime_type: string }> = new Map();
  bids: Map<string, Bid> = new Map();
  bookings: Map<string, Booking> = new Map();
  reviews: Map<string, Review> = new Map();
  reports: Map<string, Report> = new Map();
  notifications: Map<string, Notification> = new Map();
  auditLogs: AuditLog[] = [];
  otpCodes: Map<string, OtpCode> = new Map();
  sessions: Map<string, Session> = new Map();
  rateLimits: Map<string, { count: number; windowStart: number }> = new Map();
  appSettings: Map<string, string> = new Map([
    ["identity_policy", "pending_ok"],
    ["match_radius_km", "5"],
    ["job_expiry_days", "7"],
    ["min_bids_target", "3"],
    ["expand_after_hours", "6"],
  ]);

  constructor() {
    this.seedDemoData();
  }

  seedDemoData() {
    const now = new Date();

    // 1. Seed Demo Customer
    const customerId = "u-demo-customer";
    this.users.set(customerId, {
      id: customerId,
      phone: "+923001112233",
      phone_verified_at: now,
      display_name: "[DEMO] Tariq Customer",
      is_customer: true,
      is_worker: false,
      is_admin: false,
      account_status: "active",
      status_reason: null,
      suspended_until: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    // 2. Seed Demo Electrician
    const elecId = "u-demo-worker-elec";
    this.users.set(elecId, {
      id: elecId,
      phone: "+923004445566",
      phone_verified_at: now,
      display_name: "[DEMO] Rashid Electrician",
      is_customer: true,
      is_worker: true,
      is_admin: false,
      account_status: "active",
      status_reason: null,
      suspended_until: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    this.workerProfiles.set(elecId, {
      user_id: elecId,
      bio: "[DEMO] Licensed industrial and domestic electrician with 8 years experience in Lahore.",
      experience_years: 8,
      identity_status: "verified",
      identity_rejection_reason: null,
      is_demo: true,
      categories: [2], // Electrical
      areas: [1, 2, 4, 5, 10], // Gulberg, DHA, Johar Town, Model Town, Cantt
      available: true,
      created_at: now,
      updated_at: now,
    });

    // 3. Seed Demo Plumber
    const plumbId = "u-demo-worker-plumb";
    this.users.set(plumbId, {
      id: plumbId,
      phone: "+923007778899",
      phone_verified_at: now,
      display_name: "[DEMO] Akram Plumber",
      is_customer: true,
      is_worker: true,
      is_admin: false,
      account_status: "active",
      status_reason: null,
      suspended_until: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    this.workerProfiles.set(plumbId, {
      user_id: plumbId,
      bio: "[DEMO] Master sanitary and PPRC concealed pipe welding specialist with 10 years experience in Lahore.",
      experience_years: 10,
      identity_status: "verified",
      identity_rejection_reason: null,
      is_demo: true,
      categories: [1], // Plumbing
      areas: [1, 4, 5, 8, 9], // Gulberg, Johar Town, Model Town, Faisal Town, Garden Town
      available: true,
      created_at: now,
      updated_at: now,
    });

    // 4. Seed Demo Moderator
    const adminId = "u-demo-admin";
    this.users.set(adminId, {
      id: adminId,
      phone: "+923001234567",
      phone_verified_at: now,
      display_name: "[DEMO] Fatima Moderator",
      is_customer: false,
      is_worker: false,
      is_admin: true,
      account_status: "active",
      status_reason: null,
      suspended_until: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    // 5. Seed Demo Jobs (Strictly labeled [DEMO], approximate area public, exact address private)
    const expiry = new Date(Date.now() + 7 * 86400 * 1000);

    // Demo Job 1: Plumbing in Gulberg
    const j1 = "job-demo-001";
    this.jobs.set(j1, {
      id: j1,
      customer_id: customerId,
      category_id: 1, // Plumbing
      area_id: 1, // Gulberg
      title: "[DEMO] Concealed bathroom PPRC pipe leak repair",
      description: "[DEMO] Fictional job for pilot testing: Concealed joint leaking behind tiles in ground floor bathroom. Minimal tile-break diagnostic and welding needed.",
      budget_min: 3500,
      budget_max: 5000,
      asap: true,
      preferred_at: null,
      status: "open",
      match_radius_km: 5,
      is_demo: true,
      published_at: now,
      expires_at: expiry,
      hidden_at: null,
      created_at: now,
      updated_at: now,
    });
    this.jobPrivates.set(j1, {
      job_id: j1,
      address_text: "[DEMO] House 24-B, Street 9, Block H, Gulberg III, Lahore",
      contact_note: "Please ring the bell at main gate",
      lat: 31.512,
      lng: 74.344,
    });

    // Bid on Job 1 by Akram Plumber
    const b1 = "bid-demo-001";
    this.bids.set(b1, {
      id: b1,
      job_id: j1,
      worker_id: plumbId,
      amount: 4000,
      timing_text: "Today within 2 hours",
      message: "[DEMO] I have thermal diagnostic leak equipment and hot-melt welding tool. 10 years experience in Gulberg.",
      inclusions: "Labour, pipe joint welding, and pressure testing",
      exclusions: "Replacement tile cement or painting",
      status: "active",
      hidden_at: null,
      created_at: now,
      updated_at: now,
    });

    // Demo Job 2: Electrical in DHA Phase 5
    const j2 = "job-demo-002";
    this.jobs.set(j2, {
      id: j2,
      customer_id: customerId,
      category_id: 2, // Electrical
      area_id: 2, // DHA Phase 5
      title: "[DEMO] Main 63A breaker tripping on heavy appliance load",
      description: "[DEMO] Fictional job for pilot testing: Main breaker repeatedly trips when inverter AC and geyser are on simultaneously. Need load-balance assessment.",
      budget_min: 2500,
      budget_max: 4500,
      asap: true,
      preferred_at: null,
      status: "open",
      match_radius_km: 5,
      is_demo: true,
      published_at: now,
      expires_at: expiry,
      hidden_at: null,
      created_at: now,
      updated_at: now,
    });
    this.jobPrivates.set(j2, {
      job_id: j2,
      address_text: "[DEMO] Sector C, Street 14, House 102, DHA Phase 5, Lahore",
      contact_note: "Security pass needed at gate, tell guard you are visiting House 102",
      lat: 31.477,
      lng: 74.4,
    });

    // Bid on Job 2 by Rashid Electrician
    const b2 = "bid-demo-002";
    this.bids.set(b2, {
      id: b2,
      job_id: j2,
      worker_id: elecId,
      amount: 3200,
      timing_text: "Today at 4:30 PM",
      message: "[DEMO] Certified contractor with digital clamp meter. Will inspect DB phase balance and test breaker trip rating.",
      inclusions: "Load test, circuit diagnostic, and terminal tightening",
      exclusions: "Cost of new breaker if burnt out",
      status: "active",
      hidden_at: null,
      created_at: now,
      updated_at: now,
    });

    // Demo Job 3: Electrical in Model Town
    const j3 = "job-demo-003";
    this.jobs.set(j3, {
      id: j3,
      customer_id: customerId,
      category_id: 2, // Electrical
      area_id: 5, // Model Town
      title: "[DEMO] Water suction pump capacitor and starter switch repair",
      description: "[DEMO] Fictional job for pilot testing: 1.5 HP underground suction pump is humming but not rotating. Need capacitor check and starter replacement.",
      budget_min: 2000,
      budget_max: 3500,
      asap: false,
      preferred_at: new Date(Date.now() + 86400 * 1000),
      status: "open",
      match_radius_km: 5,
      is_demo: true,
      published_at: now,
      expires_at: expiry,
      hidden_at: null,
      created_at: now,
      updated_at: now,
    });
    this.jobPrivates.set(j3, {
      job_id: j3,
      address_text: "[DEMO] Block J, House 48, Model Town, Lahore",
      contact_note: "Water motor is in the back courtyard",
      lat: 31.4826,
      lng: 74.3239,
    });
  }

  // --- Rate limiting ---
  checkRateLimit(key: string, limit: number, windowSec: number): void {
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(nowSec / windowSec) * windowSec;
    const entry = this.rateLimits.get(key);
    if (!entry || entry.windowStart !== windowStart) {
      this.rateLimits.set(key, { count: 1, windowStart });
      return;
    }
    if (entry.count >= limit) {
      throw new AppError("Too many attempts. Please wait a few minutes and try again.", "rate_limited");
    }
    entry.count++;
  }

  // --- Auth & Sessions ---
  getUserById(id: string): User | null {
    const u = this.users.get(id);
    if (!u || u.deleted_at) return null;
    return { ...u };
  }

  getUserByPhone(phone: string): User | null {
    for (const u of this.users.values()) {
      if (u.phone === phone && !u.deleted_at) return { ...u };
    }
    return null;
  }

  getUserBySession(tokenHash: string): User | null {
    const s = this.sessions.get(tokenHash);
    if (!s || s.expires_at < new Date()) return null;
    return this.getUserById(s.user_id);
  }

  saveSession(userId: string, tokenHash: string, days: number): void {
    this.sessions.set(tokenHash, {
      user_id: userId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + days * 86400 * 1000),
      created_at: new Date(),
    });
  }

  deleteSession(tokenHash: string): void {
    this.sessions.delete(tokenHash);
  }

  recordOtp(phone: string, codeHash: string, ttlMin: number): void {
    const id = `otp-${Date.now()}-${randomInt(1000, 9999)}`;
    this.otpCodes.set(id, {
      id,
      phone,
      code_hash: codeHash,
      attempts: 0,
      expires_at: new Date(Date.now() + ttlMin * 60 * 1000),
      consumed_at: null,
      created_at: new Date(),
    });
  }

  consumeOtp(phone: string, code: string, hmacFn: (raw: string) => string): string {
    const now = new Date();
    // find newest active otp for phone
    let target: OtpCode | null = null;
    for (const o of Array.from(this.otpCodes.values()).reverse()) {
      if (o.phone === phone && !o.consumed_at && o.expires_at > now) {
        target = o;
        break;
      }
    }
    if (!target || target.attempts >= 5) {
      throw new AppError("That code has expired. Request a new one.");
    }
    target.attempts++;

    const expected = hmacFn(phone + ":" + code);
    if (target.code_hash !== expected) {
      throw new AppError("Incorrect code.");
    }
    target.consumed_at = now;

    // find or create user
    let user = this.getUserByPhone(phone);
    if (!user) {
      const newId = `u-${Date.now()}-${randomBytes(4).toString("hex")}`;
      user = {
        id: newId,
        phone,
        phone_verified_at: now,
        display_name: null,
        is_customer: true,
        is_worker: false,
        is_admin: false,
        account_status: "active",
        status_reason: null,
        suspended_until: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      this.users.set(newId, user);
      this.audit(newId, "user.created", "user", newId);
    } else {
      user.phone_verified_at = now;
      user.updated_at = now;
      this.users.set(user.id, user);
    }
    return user.id;
  }

  // --- Public & Worker Job Discovery ---
  getPublicJobs(): Array<{
    id: string; title: string; description: string; category: string; area: string; status: JobStatus;
    budget_min: number | null; budget_max: number | null; asap: boolean; preferred_at: Date | null;
    created_at: Date; expires_at: Date; bid_count: number; is_demo: boolean;
  }> {
    const list: any[] = [];
    for (const j of this.jobs.values()) {
      if (j.status === "open" && !j.hidden_at && j.expires_at > new Date()) {
        const cat = getCategoryById(j.category_id)?.name ?? "Service";
        const ar = getAreaById(j.area_id)?.name ?? "Lahore";
        let bids = 0;
        for (const b of this.bids.values()) {
          if (b.job_id === j.id && ["active", "accepted"].includes(b.status)) bids++;
        }
        list.push({
          id: j.id,
          title: j.title,
          description: j.description,
          category: cat,
          area: ar,
          status: j.status,
          budget_min: j.budget_min,
          budget_max: j.budget_max,
          asap: j.asap,
          preferred_at: j.preferred_at,
          created_at: j.created_at,
          expires_at: j.expires_at,
          bid_count: bids,
          is_demo: j.is_demo,
        });
      }
    }
    return list.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  browseJobsForWorker(workerId: string): any[] {
    const wp = this.workerProfiles.get(workerId);
    if (!wp || !wp.available) return [];
    const wCategories = new Set(wp.categories);
    const wAreas = new Set(wp.areas);

    const out: any[] = [];
    for (const j of this.jobs.values()) {
      if (j.status !== "open" || j.hidden_at || j.expires_at <= new Date() || j.customer_id === workerId) {
        continue;
      }
      // Check trade category match
      if (!wCategories.has(j.category_id)) continue;

      // Check area or radius match
      const jobArea = getAreaById(j.area_id);
      let inArea = wAreas.has(j.area_id);
      if (!inArea && jobArea) {
        for (const aId of wAreas) {
          const wArea = getAreaById(aId);
          if (wArea && haversineDistanceKm(jobArea.lat, jobArea.lng, wArea.lat, wArea.lng) <= j.match_radius_km) {
            inArea = true;
            break;
          }
        }
      }
      if (!inArea) continue;

      // Count active bids and check worker's own bid status
      let bids = 0;
      let myBidStatus: string | null = null;
      for (const b of this.bids.values()) {
        if (b.job_id === j.id && ["active", "accepted"].includes(b.status)) bids++;
        if (b.job_id === j.id && b.worker_id === workerId) myBidStatus = b.status;
      }

      out.push({
        id: j.id,
        title: j.title,
        description: j.description,
        category: getCategoryById(j.category_id)?.name ?? "Service",
        area: getAreaById(j.area_id)?.name ?? "Lahore",
        status: j.status,
        budget_min: j.budget_min,
        budget_max: j.budget_max,
        asap: j.asap,
        preferred_at: j.preferred_at,
        created_at: j.created_at,
        expires_at: j.expires_at,
        bid_count: bids,
        my_bid_status: myBidStatus,
        is_demo: j.is_demo,
      });
    }
    return out.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  getEligibleJob(workerId: string, jobId: string): any | null {
    const workerJobs = this.browseJobsForWorker(workerId);
    return workerJobs.find(j => j.id === jobId) || null;
  }

  getCustomerJob(customerId: string, jobId: string): any | null {
    const j = this.jobs.get(jobId);
    if (!j || j.customer_id !== customerId) return null;
    let bids = 0;
    for (const b of this.bids.values()) {
      if (b.job_id === j.id && ["active", "accepted"].includes(b.status)) bids++;
    }
    return {
      id: j.id,
      title: j.title,
      description: j.description,
      category: getCategoryById(j.category_id)?.name ?? "Service",
      area: getAreaById(j.area_id)?.name ?? "Lahore",
      status: j.status,
      budget_min: j.budget_min,
      budget_max: j.budget_max,
      asap: j.asap,
      preferred_at: j.preferred_at,
      created_at: j.created_at,
      expires_at: j.expires_at,
      bid_count: bids,
      my_bid_status: null,
      customer_id: j.customer_id,
      hidden_at: j.hidden_at,
      photo_ids: [],
      is_demo: j.is_demo,
    };
  }

  listCustomerJobs(customerId: string): any[] {
    const out: any[] = [];
    for (const j of this.jobs.values()) {
      if (j.customer_id !== customerId) continue;
      let bids = 0;
      for (const b of this.bids.values()) {
        if (b.job_id === j.id && ["active", "accepted"].includes(b.status)) bids++;
      }
      out.push({
        id: j.id,
        title: j.title,
        description: j.description,
        category: getCategoryById(j.category_id)?.name ?? "Service",
        area: getAreaById(j.area_id)?.name ?? "Lahore",
        status: j.status,
        budget_min: j.budget_min,
        budget_max: j.budget_max,
        asap: j.asap,
        preferred_at: j.preferred_at,
        created_at: j.created_at,
        expires_at: j.expires_at,
        bid_count: bids,
        my_bid_status: null,
        is_demo: j.is_demo,
      });
    }
    return out.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  getPrivateDetails(userId: string, jobId: string): any | null {
    // Find active booking for this job
    let booking: Booking | null = null;
    for (const bk of this.bookings.values()) {
      if (bk.job_id === jobId && (bk.customer_id === userId || bk.worker_id === userId)) {
        booking = bk;
        break;
      }
    }
    if (!booking || !CONTACT_VISIBLE.includes(booking.status)) return null;

    const priv = this.jobPrivates.get(jobId);
    const customer = this.users.get(booking.customer_id);
    const worker = this.users.get(booking.worker_id);

    return {
      address_text: priv?.address_text ?? "",
      contact_note: priv?.contact_note ?? null,
      customer_phone: customer?.phone ?? "",
      customer_name: customer?.display_name ?? null,
      worker_phone: worker?.phone ?? "",
      worker_name: worker?.display_name ?? null,
      lat: priv?.lat ?? null,
      lng: priv?.lng ?? null,
    };
  }

  // --- Job Actions ---
  createDraft(customerId: string, data: {
    categoryId: number; areaId: number; title: string; description: string;
    budgetMin?: number; budgetMax?: number; asap: boolean; preferredAt?: Date | null;
    addressText: string; contactNote?: string; lat?: number; lng?: number;
  }): string {
    const id = `job-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const now = new Date();
    const expiryDays = Number(this.appSettings.get("job_expiry_days") || 7);
    const radius = Number(this.appSettings.get("match_radius_km") || 5);

    const job: Job = {
      id,
      customer_id: customerId,
      category_id: data.categoryId,
      area_id: data.areaId,
      title: data.title,
      description: data.description,
      budget_min: data.budgetMin ?? null,
      budget_max: data.budgetMax ?? null,
      asap: data.asap,
      preferred_at: data.preferredAt ?? null,
      status: "draft",
      match_radius_km: radius,
      is_demo: false,
      published_at: null,
      expires_at: new Date(Date.now() + expiryDays * 86400 * 1000),
      hidden_at: null,
      created_at: now,
      updated_at: now,
    };
    this.jobs.set(id, job);
    this.jobPrivates.set(id, {
      job_id: id,
      address_text: data.addressText,
      contact_note: data.contactNote || null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    });
    this.audit(customerId, "job.draft_created", "job", id);
    return id;
  }

  publishJob(customerId: string, jobId: string): void {
    const j = this.jobs.get(jobId);
    if (!j || j.customer_id !== customerId) throw new AppError("Job not found.", "not_found");
    assertTransition(j.status, "open", "customer");
    const expiryDays = Number(this.appSettings.get("job_expiry_days") || 7);
    j.status = "open";
    j.published_at = new Date();
    j.expires_at = new Date(Date.now() + expiryDays * 86400 * 1000);
    j.updated_at = new Date();
    this.jobs.set(jobId, j);
    this.audit(customerId, "job.published", "job", jobId);

    // Notify matching workers
    const cat = getCategoryById(j.category_id)?.name ?? "Service";
    const ar = getAreaById(j.area_id)?.name ?? "Lahore";
    for (const [wId, wp] of this.workerProfiles.entries()) {
      if (wId !== customerId && wp.available && wp.categories.includes(j.category_id) && wp.areas.includes(j.area_id)) {
        this.notify(wId, "job_match", `New ${cat.toLowerCase()} job in ${ar}`,
          "A customer in your service area is asking for bids. Open the job to see details.",
          { type: "job", id: jobId });
      }
    }
  }

  cancelJob(customerId: string, jobId: string): void {
    const j = this.jobs.get(jobId);
    if (!j || j.customer_id !== customerId) throw new AppError("Job not found.", "not_found");
    assertTransition(j.status, "cancelled", "customer");
    j.status = "cancelled";
    j.updated_at = new Date();
    this.jobs.set(jobId, j);

    for (const b of this.bids.values()) {
      if (b.job_id === jobId && b.status === "active") {
        b.status = "rejected";
        b.updated_at = new Date();
      }
    }
    this.audit(customerId, "job.cancelled", "job", jobId);
  }

  // --- Bids & Acceptance ---
  submitBid(workerId: string, jobId: string, data: {
    amount: number; timingText: string; message: string; inclusions: string; exclusions: string;
  }): void {
    const u = this.users.get(workerId);
    if (!u || u.account_status !== "active") {
      throw new AppError("Your account is restricted. You cannot bid.", "forbidden");
    }
    const j = this.jobs.get(jobId);
    if (!j || j.status !== "open" || j.hidden_at || j.expires_at <= new Date()) {
      throw new AppError("This job is no longer open for bids.");
    }
    const wp = this.workerProfiles.get(workerId);
    if (!wp || !wp.available) throw new AppError("Turn on 'accepting bids' in your profile to bid.");

    // Check existing
    for (const b of this.bids.values()) {
      if (b.job_id === jobId && b.worker_id === workerId && b.status === "active") {
        b.amount = data.amount;
        b.timing_text = data.timingText;
        b.message = data.message;
        b.inclusions = data.inclusions;
        b.exclusions = data.exclusions;
        b.updated_at = new Date();
        this.audit(workerId, "bid.updated", "bid", b.id);
        return;
      }
    }

    const bidId = `bid-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const now = new Date();
    this.bids.set(bidId, {
      id: bidId,
      job_id: jobId,
      worker_id: workerId,
      amount: data.amount,
      timing_text: data.timingText,
      message: data.message,
      inclusions: data.inclusions,
      exclusions: data.exclusions,
      status: "active",
      hidden_at: null,
      created_at: now,
      updated_at: now,
    });
    this.audit(workerId, "bid.created", "bid", bidId);

    // Notify customer
    this.notify(j.customer_id, "new_bid", "New bid on your job",
      `A technician bid Rs ${data.amount.toLocaleString("en-PK")} on "${j.title}".`,
      { type: "job", id: jobId });
  }

  withdrawBid(workerId: string, bidId: string): void {
    const b = this.bids.get(bidId);
    if (!b || b.worker_id !== workerId || b.status !== "active") {
      throw new AppError("That bid can't be withdrawn (it may already be accepted).");
    }
    b.status = "withdrawn";
    b.updated_at = new Date();
    this.audit(workerId, "bid.withdrawn", "bid", bidId);
  }

  listBidsForCustomer(customerId: string, jobId: string): any[] {
    const j = this.jobs.get(jobId);
    if (!j || j.customer_id !== customerId) throw new AppError("Job not found.", "not_found");

    const out: any[] = [];
    for (const b of this.bids.values()) {
      if (b.job_id === jobId && ["active", "accepted"].includes(b.status) && !b.hidden_at) {
        const worker = this.users.get(b.worker_id);
        const wp = this.workerProfiles.get(b.worker_id);
        const rep = this.reputationFor([b.worker_id]).get(b.worker_id);

        out.push({
          id: b.id,
          worker_id: b.worker_id,
          amount: b.amount,
          timing_text: b.timing_text,
          message: b.message,
          inclusions: b.inclusions,
          exclusions: b.exclusions,
          status: b.status,
          created_at: b.created_at,
          updated_at: b.updated_at,
          worker_name: worker?.display_name ?? "Technician",
          bio: wp?.bio ?? "",
          experience_years: wp?.experience_years ?? null,
          identity_status: wp?.identity_status ?? "not_submitted",
          rep,
          categories: (wp?.categories ?? []).map(cid => getCategoryById(cid)?.name ?? ""),
        });
      }
    }
    return out.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }

  myBids(workerId: string): any[] {
    const out: any[] = [];
    for (const b of this.bids.values()) {
      if (b.worker_id === workerId) {
        const j = this.jobs.get(b.job_id);
        out.push({
          id: b.id,
          job_id: b.job_id,
          title: j?.title ?? "Job",
          amount: b.amount,
          status: b.status,
          job_status: j?.status ?? "unknown",
          updated_at: b.updated_at,
        });
      }
    }
    return out.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }

  acceptBid(customerId: string, bidId: string): { bookingId: string } {
    const b = this.bids.get(bidId);
    if (!b) throw new AppError("Bid not found.", "not_found");
    const j = this.jobs.get(b.job_id);
    if (!j || j.customer_id !== customerId) throw new AppError("Bid not found.", "not_found");
    if (j.hidden_at) throw new AppError("This job is under review and can't be awarded.");
    assertTransition(j.status, "awarded", "customer");
    if (b.status !== "active") throw new AppError("That bid is no longer active.");

    const now = new Date();
    // 1. Mark accepted bid
    b.status = "accepted";
    b.updated_at = now;

    // 2. Reject other active bids
    for (const other of this.bids.values()) {
      if (other.job_id === j.id && other.id !== bidId && other.status === "active") {
        other.status = "rejected";
        other.updated_at = now;
        this.notify(other.worker_id, "bid_rejected", "Customer chose another bid",
          `The customer chose a different technician for "${j.title}".`,
          { type: "job", id: j.id });
      }
    }

    // 3. Mark job awarded
    j.status = "awarded";
    j.updated_at = now;

    // 4. Create booking
    const bookingId = `bk-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const code = completionCodeForJob(j.id);
    const bk: Booking = {
      id: bookingId,
      job_id: j.id,
      customer_id: customerId,
      worker_id: b.worker_id,
      bid_id: bidId,
      status: "awarded",
      selected_at: now,
      started_at: null,
      completion_requested_at: null,
      completed_at: null,
      disputed_at: null,
      cancelled_at: null,
      completion_code: code,
      completion_code_attempts: 0,
      created_at: now,
      updated_at: now,
    };
    this.bookings.set(bookingId, bk);

    this.audit(customerId, "bid.accepted", "bid", bidId);
    this.notify(b.worker_id, "bid_accepted", "Your bid was accepted!",
      `Open the job to see the address and contact details for "${j.title}".`,
      { type: "job", id: j.id });

    return { bookingId };
  }

  // --- Bookings & Lifecycle ---
  getBookingByJob(userId: string, jobId: string): any | null {
    for (const bk of this.bookings.values()) {
      if (bk.job_id === jobId && (bk.customer_id === userId || bk.worker_id === userId)) {
        const j = this.jobs.get(bk.job_id);
        const b = this.bids.get(bk.bid_id);
        const customer = this.users.get(bk.customer_id);
        const worker = this.users.get(bk.worker_id);

        return {
          id: bk.id,
          job_id: bk.job_id,
          customer_id: bk.customer_id,
          worker_id: bk.worker_id,
          status: bk.status,
          amount: b?.amount ?? 0,
          selected_at: bk.selected_at,
          started_at: bk.started_at,
          completion_requested_at: bk.completion_requested_at,
          completed_at: bk.completed_at,
          title: j?.title ?? "Job",
          customer_name: customer?.display_name ?? null,
          worker_name: worker?.display_name ?? null,
          completion_code_attempts: bk.completion_code_attempts,
        };
      }
    }
    return null;
  }

  myBookings(userId: string): any[] {
    const out: any[] = [];
    for (const bk of this.bookings.values()) {
      if (bk.customer_id === userId || bk.worker_id === userId) {
        const j = this.jobs.get(bk.job_id);
        const b = this.bids.get(bk.bid_id);
        const customer = this.users.get(bk.customer_id);
        const worker = this.users.get(bk.worker_id);

        out.push({
          id: bk.id,
          job_id: bk.job_id,
          customer_id: bk.customer_id,
          worker_id: bk.worker_id,
          status: bk.status,
          amount: b?.amount ?? 0,
          selected_at: bk.selected_at,
          started_at: bk.started_at,
          completion_requested_at: bk.completion_requested_at,
          completed_at: bk.completed_at,
          title: j?.title ?? "Job",
          customer_name: customer?.display_name ?? null,
          worker_name: worker?.display_name ?? null,
          completion_code_attempts: bk.completion_code_attempts,
        });
      }
    }
    return out.sort((a, b) => b.selected_at.getTime() - a.selected_at.getTime());
  }

  progressBooking(userId: string, bookingId: string, action: string, code?: string): void {
    const bk = this.bookings.get(bookingId);
    if (!bk || (bk.customer_id !== userId && bk.worker_id !== userId)) {
      throw new AppError("Booking not found.", "not_found");
    }
    const isCustomer = bk.customer_id === userId;
    const isWorker = bk.worker_id === userId;
    const actor: Actor = isCustomer ? "customer" : "worker";
    const j = this.jobs.get(bk.job_id);

    const now = new Date();
    switch (action) {
      case "start": {
        if (!isWorker) throw new AppError("Only the selected worker can mark start.", "forbidden");
        assertTransition(bk.status, "in_progress", actor);
        bk.status = "in_progress";
        bk.started_at = now;
        bk.updated_at = now;
        if (j) { j.status = "in_progress"; j.updated_at = now; }
        this.notify(bk.customer_id, "booking_started", "Technician started the job",
          "The technician marked their arrival and started the job.",
          { type: "job", id: bk.job_id });
        break;
      }
      case "request_completion": {
        if (!isWorker) throw new AppError("Only the selected worker can request completion.", "forbidden");
        assertTransition(bk.status, "completion_requested", actor);
        bk.status = "completion_requested";
        bk.completion_requested_at = now;
        bk.updated_at = now;
        if (j) { j.status = "completion_requested"; j.updated_at = now; }

        const entered = (code ?? "").trim();
        if (entered) {
          if (bk.completion_code_attempts >= 5) {
            throw new AppError("Too many wrong codes. Leave it for the customer to confirm.");
          }
          if (entered === bk.completion_code) {
            // Customer code entered
            bk.status = "completed";
            bk.completed_at = now;
            if (j) { j.status = "completed"; j.updated_at = now; }
            this.notify(bk.customer_id, "booking_completed", "Job marked completed",
              "The completion code was entered. You can now leave a review.",
              { type: "job", id: bk.job_id });
            break;
          } else {
            bk.completion_code_attempts++;
            throw new AppError("Incorrect completion code.");
          }
        }
        this.notify(bk.customer_id, "booking_completion_requested", "Technician requested completion",
          "Please inspect the work and confirm completion, or report a problem.",
          { type: "job", id: bk.job_id });
        break;
      }
      case "confirm": {
        if (!isCustomer) throw new AppError("Only the customer can confirm completion.", "forbidden");
        assertTransition(bk.status, "completed", actor);
        bk.status = "completed";
        bk.completed_at = now;
        bk.updated_at = now;
        if (j) { j.status = "completed"; j.updated_at = now; }
        this.notify(bk.worker_id, "booking_completed", "Job confirmed complete",
          "The customer confirmed completion. You can now leave a review.",
          { type: "job", id: bk.job_id });
        break;
      }
      case "not_finished": {
        if (!isCustomer) throw new AppError("Only the customer can do this.", "forbidden");
        assertTransition(bk.status, "in_progress", actor);
        bk.status = "in_progress";
        bk.updated_at = now;
        if (j) { j.status = "in_progress"; j.updated_at = now; }
        this.notify(bk.worker_id, "booking_not_finished", "Customer requested more work",
          "The customer marked the job as still in progress.",
          { type: "job", id: bk.job_id });
        break;
      }
      default:
        throw new AppError("Invalid action.");
    }
    this.audit(userId, `booking.${action}`, "booking", bookingId);
  }

  reportProblem(userId: string, bookingId: string, details: string): void {
    const bk = this.bookings.get(bookingId);
    if (!bk || (bk.customer_id !== userId && bk.worker_id !== userId)) {
      throw new AppError("Booking not found.", "not_found");
    }
    const actor: Actor = bk.customer_id === userId ? "customer" : "worker";
    assertTransition(bk.status, "disputed", actor);
    bk.status = "disputed";
    bk.disputed_at = new Date();
    bk.updated_at = new Date();

    const j = this.jobs.get(bk.job_id);
    if (j) { j.status = "disputed"; j.updated_at = new Date(); }

    this.createReport(userId, "booking", bookingId, "dispute", details);
    this.audit(userId, "booking.disputed", "booking", bookingId, { details });
  }

  // --- Reviews & Retaliation Protection ---
  submitReview(userId: string, bookingId: string, stars: number, comment?: string): void {
    const bk = this.bookings.get(bookingId);
    if (!bk || (bk.customer_id !== userId && bk.worker_id !== userId)) {
      throw new AppError("Booking not found.", "not_found");
    }
    if (bk.status !== "completed") {
      throw new AppError("You can review only after the job is completed.");
    }

    // Check duplicate
    for (const r of this.reviews.values()) {
      if (r.booking_id === bookingId && r.reviewer_id === userId) {
        throw new AppError("You've already reviewed this booking.");
      }
    }

    const revieweeId = bk.customer_id === userId ? bk.worker_id : bk.customer_id;
    const reviewId = `rev-${Date.now()}-${randomBytes(3).toString("hex")}`;
    this.reviews.set(reviewId, {
      id: reviewId,
      booking_id: bookingId,
      reviewer_id: userId,
      reviewee_id: revieweeId,
      stars,
      comment: (comment || "").trim(),
      status: "visible",
      hidden_reason: null,
      created_at: new Date(),
    });

    this.audit(userId, "review.created", "booking", bookingId, { stars });
    this.notify(revieweeId, "review_received", "You received a review",
      "Reviews become visible when both sides have reviewed, or after 7 days.",
      { type: "job", id: bk.job_id });
  }

  reviewStateForBooking(userId: string, bookingId: string): { mine: boolean; theirs: boolean } {
    let mine = false;
    let theirs = false;
    for (const r of this.reviews.values()) {
      if (r.booking_id === bookingId) {
        if (r.reviewer_id === userId) mine = true;
        else theirs = true;
      }
    }
    return { mine, theirs };
  }

  revealedReviewsFor(userId: string): Array<{ id: string; stars: number; comment: string | null; created_at: Date; reviewer_name: string | null }> {
    const now = Date.now();
    const sevenDaysMs = 7 * 86400 * 1000;
    const out: any[] = [];

    for (const r of this.reviews.values()) {
      if (r.reviewee_id !== userId || r.status !== "visible") continue;

      // Anti-retaliation rule: revealed if other party also reviewed OR 7 days passed
      const otherReviewed = Array.from(this.reviews.values()).some(
        o => o.booking_id === r.booking_id && o.id !== r.id
      );
      const timePassed = (now - r.created_at.getTime()) >= sevenDaysMs;

      if (otherReviewed || timePassed) {
        const reviewer = this.users.get(r.reviewer_id);
        out.push({
          id: r.id,
          stars: r.stars,
          comment: r.comment || null,
          created_at: r.created_at,
          reviewer_name: reviewer?.display_name ?? "User",
        });
      }
    }
    return out.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  reputationFor(userIds: string[]): Map<string, {
    user_id: string; rating_count: number; rating_avg: number | null;
    completed_as_worker: number; completed_as_customer: number;
  }> {
    const map = new Map<string, any>();
    for (const id of userIds) {
      const revs = this.revealedReviewsFor(id);
      const count = revs.length;
      const avg = count ? Number((revs.reduce((acc, r) => acc + r.stars, 0) / count).toFixed(1)) : null;

      let asWorker = 0;
      let asCustomer = 0;
      for (const bk of this.bookings.values()) {
        if (bk.status === "completed") {
          if (bk.worker_id === id) asWorker++;
          if (bk.customer_id === id) asCustomer++;
        }
      }

      map.set(id, {
        user_id: id,
        rating_count: count,
        rating_avg: avg,
        completed_as_worker: asWorker,
        completed_as_customer: asCustomer,
      });
    }
    return map;
  }

  // --- Reports & Moderation ---
  createReport(reporterId: string, targetType: string, targetId: string, category: string, details?: string): void {
    if (targetType === "user" && targetId === reporterId) {
      throw new AppError("You can't report yourself.");
    }
    const reportId = `rep-${Date.now()}-${randomBytes(3).toString("hex")}`;
    this.reports.set(reportId, {
      id: reportId,
      reporter_id: reporterId,
      target_type: targetType as any,
      target_id: targetId,
      category,
      details: details ?? null,
      status: "open",
      internal_notes: null,
      resolved_by: null,
      resolved_at: null,
      created_at: new Date(),
    });
    this.audit(reporterId, "report.created", targetType, targetId, { category });
  }

  reportQueue(status = "open"): any[] {
    const out: any[] = [];
    for (const r of this.reports.values()) {
      if (r.status !== status) continue;
      const reporter = this.users.get(r.reporter_id);
      let targetLabel = "(Target)";
      if (r.target_type === "user") targetLabel = this.users.get(r.target_id)?.display_name ?? "(User)";
      else if (r.target_type === "job") targetLabel = this.jobs.get(r.target_id)?.title ?? "(Job)";
      else if (r.target_type === "bid") targetLabel = this.bids.get(r.target_id)?.message.slice(0, 50) ?? "(Bid)";
      else if (r.target_type === "review") targetLabel = this.reviews.get(r.target_id)?.comment.slice(0, 50) ?? "(Review)";
      else if (r.target_type === "booking") {
        const bk = this.bookings.get(r.target_id);
        targetLabel = bk ? `Booking on "${this.jobs.get(bk.job_id)?.title ?? "Job"}"` : "(Booking)";
      }

      out.push({
        id: r.id,
        target_type: r.target_type,
        target_id: r.target_id,
        category: r.category,
        details: r.details,
        status: r.status,
        internal_notes: r.internal_notes,
        created_at: r.created_at,
        reporter_name: reporter?.display_name ?? "User",
        target_label: targetLabel,
      });
    }
    return out.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  addReportNote(adminId: string, reportId: string, note: string): void {
    const r = this.reports.get(reportId);
    if (!r) throw new AppError("Report not found.", "not_found");
    const admin = this.users.get(adminId);
    r.internal_notes = (r.internal_notes ? r.internal_notes + "\n" : "") + `[${admin?.display_name ?? "admin"}] ${note.trim()}`;
    this.audit(adminId, "report.note_added", "report", reportId);
  }

  moderate(adminId: string, action: string, targetType: string, targetId: string, reportId?: string, reason = "", days = 0): void {
    const admin = this.users.get(adminId);
    if (!admin?.is_admin) throw new AppError("Forbidden", "forbidden");

    if (["warn", "suspend", "ban", "reinstate"].includes(action)) {
      const u = this.users.get(targetId);
      if (!u) throw new AppError("User not found.", "not_found");
      if (u.is_admin) throw new AppError("Admin accounts can't be actioned.", "forbidden");

      if (action === "warn") {
        this.notify(targetId, "warning", "Warning from moderators", reason);
      } else if (action === "suspend") {
        if (days < 1 || days > 90) throw new AppError("Suspension must be 1–90 days.");
        u.account_status = "suspended";
        u.status_reason = reason;
        u.suspended_until = new Date(Date.now() + days * 86400 * 1000);
        u.updated_at = new Date();
        // Clear sessions
        for (const [k, s] of this.sessions.entries()) {
          if (s.user_id === targetId) this.sessions.delete(k);
        }
      } else if (action === "ban") {
        u.account_status = "banned";
        u.status_reason = reason;
        u.suspended_until = null;
        u.updated_at = new Date();
        for (const [k, s] of this.sessions.entries()) {
          if (s.user_id === targetId) this.sessions.delete(k);
        }
        for (const b of this.bids.values()) {
          if (b.worker_id === targetId && b.status === "active") {
            b.status = "withdrawn";
            b.updated_at = new Date();
          }
        }
      } else if (action === "reinstate") {
        u.account_status = "active";
        u.status_reason = null;
        u.suspended_until = null;
        u.updated_at = new Date();
      }
    } else if (action === "hide_job" || action === "unhide_job") {
      const j = this.jobs.get(targetId);
      if (j) j.hidden_at = action === "hide_job" ? new Date() : null;
    } else if (action === "hide_review" || action === "unhide_review") {
      const rev = this.reviews.get(targetId);
      if (rev) {
        rev.status = action === "hide_review" ? "hidden" : "visible";
        rev.hidden_reason = reason;
      }
    } else if (action === "hide_bid") {
      const b = this.bids.get(targetId);
      if (b) b.hidden_at = new Date();
    } else if (action === "resolve_complete" || action === "resolve_cancel") {
      const bk = this.bookings.get(targetId);
      if (!bk || bk.status !== "disputed") throw new AppError("Only disputed bookings can be resolved.");
      const toStatus = action === "resolve_complete" ? "completed" : "cancelled";
      bk.status = toStatus as any;
      if (toStatus === "completed") bk.completed_at = new Date();
      bk.updated_at = new Date();
      const j = this.jobs.get(bk.job_id);
      if (j) { j.status = toStatus as any; j.updated_at = new Date(); }
    }

    if (reportId) {
      const r = this.reports.get(reportId);
      if (r) {
        r.status = action === "dismiss_report" ? "dismissed" : "actioned";
        r.resolved_by = adminId;
        r.resolved_at = new Date();
        r.internal_notes = (r.internal_notes ? r.internal_notes + "\n" : "") + reason;
      }
    }
    this.audit(adminId, `moderation.${action}`, targetType, targetId, { reportId, reason });
  }

  identityQueue(): any[] {
    const out: any[] = [];
    for (const [wId, wp] of this.workerProfiles.entries()) {
      if (wp.identity_status === "pending_review") {
        const u = this.users.get(wId);
        out.push({
          user_id: wId,
          display_name: u?.display_name ?? "(No name)",
          phone: u?.phone ?? "",
          bio: wp.bio,
          created_at: wp.updated_at,
        });
      }
    }
    return out;
  }

  decideIdentity(adminId: string, userId: string, decision: "verified" | "rejected" | "needs_resubmission", reason: string): void {
    const wp = this.workerProfiles.get(userId);
    if (!wp) throw new AppError("Worker profile not found.", "not_found");
    wp.identity_status = decision;
    wp.identity_rejection_reason = reason;
    wp.updated_at = new Date();
    this.audit(adminId, `identity.${decision}`, "user", userId, { reason });
    this.notify(userId, "identity_decision", `Identity document review: ${decision}`,
      `Review note: ${reason}`);
  }

  // --- Worker Profiles ---
  saveWorkerProfile(userId: string, data: {
    displayName: string; bio: string; experienceYears: number;
    categoryIds: number[]; areaIds: number[]; acceptingBids: boolean;
  }): void {
    const u = this.users.get(userId);
    if (!u) throw new AppError("User not found.", "not_found");
    u.display_name = data.displayName;
    u.is_worker = true;
    u.updated_at = new Date();

    const existing = this.workerProfiles.get(userId);
    const now = new Date();
    this.workerProfiles.set(userId, {
      user_id: userId,
      bio: data.bio,
      experience_years: data.experienceYears,
      identity_status: existing?.identity_status ?? "not_submitted",
      identity_rejection_reason: existing?.identity_rejection_reason ?? null,
      is_demo: existing?.is_demo ?? false,
      categories: data.categoryIds,
      areas: data.areaIds,
      available: data.acceptingBids,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
    this.audit(userId, "worker.profile_saved", "user", userId);
  }

  getWorkerProfile(userId: string): any | null {
    const wp = this.workerProfiles.get(userId);
    if (!wp) return null;
    return {
      bio: wp.bio,
      experience_years: wp.experience_years,
      identity_status: wp.identity_status,
      accepting_bids: wp.available,
      categories: wp.categories,
      areas: wp.areas,
    };
  }

  // --- Notifications ---
  notify(userId: string, type: string, title: string, body: string, ref?: { type: string; id: string }): void {
    const id = `notif-${Date.now()}-${randomBytes(3).toString("hex")}`;
    this.notifications.set(id, {
      id,
      user_id: userId,
      type,
      title,
      body,
      ref_type: ref?.type ?? null,
      ref_id: ref?.id ?? null,
      read_at: null,
      created_at: new Date(),
    });
  }

  listNotifications(userId: string): Notification[] {
    const out: Notification[] = [];
    for (const n of this.notifications.values()) {
      if (n.user_id === userId) out.push({ ...n });
    }
    return out.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  unreadNotificationCount(userId: string): number {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (n.user_id === userId && !n.read_at) count++;
    }
    return count;
  }

  markNotificationsRead(userId: string): void {
    const now = new Date();
    for (const n of this.notifications.values()) {
      if (n.user_id === userId && !n.read_at) n.read_at = now;
    }
  }

  // --- Audit Logs ---
  audit(actorId: string | null, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}): void {
    this.auditLogs.unshift({
      id: `audit-${Date.now()}-${randomBytes(3).toString("hex")}`,
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
      created_at: new Date(),
    });
    if (this.auditLogs.length > 500) this.auditLogs.length = 500;
  }

  getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }
}

// Global persistent store instance across HMR in Node
const g = globalThis as unknown as { __maddadStore?: DomainStore };
export const store = (g.__maddadStore ??= new DomainStore());

export function getCities(): City[] {
  return CITIES;
}

export function getCategories(): Category[] {
  return CATEGORIES;
}

export function getAreas(): Area[] {
  return AREAS;
}

export function getCategoryById(id: number): Category | undefined {
  return CATEGORIES.find(c => c.id === id);
}

export function getAreaById(id: number): Area | undefined {
  return AREAS.find(a => a.id === id);
}
