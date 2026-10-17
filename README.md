# Kaam Lahore (کام لاہور)

> **Lahore-only open-bid marketplace for independent local services.**  
> Pilot categories: **Plumbing** & **Electrical Work**.

---

## 1. Product Overview

Kaam Lahore is an open-bid marketplace web application designed specifically for Lahore, Pakistan. It connects customers who need small household repairs with independent tradespeople.

### Key Philosophy & Boundaries
- **Marketplace, Not an Employer:** Workers are independent tradespeople who register, pick their service categories and Lahore service areas, and decide whether to bid. Customers post jobs, compare bids, and choose whom to hire. The platform never employs, assigns, or dispatches workers.
- **Zero Platform Funds:** The platform holds **no** customer or worker funds, offers no escrow, wallets, or payment processing, and charges no commissions in this pilot. Payment is arranged directly between customer and worker.
- **Location Privacy:** Prospective bidders see **only** the coarse neighbourhood (e.g., *Gulberg*, *Johar Town*, *DHA Phase 5*). The exact house address, contact notes, and private pin are revealed **only** to the customer and the single selected worker after a bid is accepted.
- **Manual Identity Review (No NADRA):** The platform explicitly disclaims any NADRA verification. Worker identity verification is a visual document review performed by human moderators. An "ID reviewed" badge is awarded without ever storing raw CNIC numbers or exposing ID photos publicly.
- **English-First, Urdu-Ready:** Interface architecture, typography stacks (Nastaliq & Naskh), and dictionary abstractions allow easy future Urdu localization without structural refactoring.
- **Pakistan-Specific Localization:**
  - Currency: Integer whole **PKR** (e.g. `Rs 1,500`), matching Pakistani trades quotation practices without floating-point errors.
  - Timezone: **Asia/Karachi** (UTC+5).
  - Phone format: E.164 normalization for Pakistani mobile numbers (`+923001234567`).

---

## 2. Technical Stack

- **Framework:** Next.js 14 (App Router) with TypeScript.
- **Styling:** Responsive, accessible CSS with CSS logical properties (RTL/Urdu ready) and high-contrast, mobile-friendly design.
- **Database:** PostgreSQL 16 with **PostGIS** (`geography(Point,4326)`) and `pgcrypto`.
- **Database Access:** Typed parameterised client with raw SQL migrations and transaction helpers (`src/lib/db.ts`).
- **File Storage:** Private, access-controlled local storage (`src/lib/storage.ts`) with MIME sniffing and client-side EXIF/GPS stripping.
- **Authentication:** Passwordless phone sign-in with HMAC-hashed 6-digit OTP, brute-force rate-limiting, and development simulation mode.
- **Maintenance & Background Work:** Automated runner (`scripts/maintenance.ts` or `/api/cron/maintenance`) for expiring jobs, expanding matching radiuses, and purging identity documents.

---

## 3. Core Workflows

### 3.1 Customer
1. Sign in with mobile number via OTP.
2. Post a job: select trade category (Plumbing or Electrical), neighbourhood in Lahore, private address details, preferred timing or ASAP, optional budget, and optional photos.
3. Review draft in the private preview screen and publish.
4. Compare incoming bids side-by-side: price in PKR, timing window, worker bio, experience, verified completed jobs count, star ratings, and ID badge.
5. Accept one bid: atomically closes competing bids, creates a booking, and reveals mutual contact details.
6. Share the 4-digit completion code once work is finished, confirm completion, and submit a review.

### 3.2 Worker
1. Set up worker profile: trades offered, Lahore service areas, years of experience, bio, and work photos.
2. Toggle "Accepting bids" availability.
3. Optionally submit CNIC front and back photos for manual moderator review.
4. Browse eligible open jobs matching selected trade and radius (with approximate area only).
5. Submit, update, or withdraw bids (labour offer in PKR, arrival window, message, inclusions/exclusions).
6. When selected: access customer exact address and phone, mark arrival/start, request completion (with optional customer code), and review the customer after completion.

### 3.3 Admin & Moderator
1. Review reported jobs, users, bids, reviews, and disputed bookings.
2. View internal notes and assign documented moderation actions (warn, suspend 1–90 days, ban, reinstate, hide job/review).
3. Review submitted identity documents in private storage with strictly logged access.
4. Manually trigger radius expansion for jobs with low bid counts.
5. Configure live marketplace parameters (worker identity policy: `open` | `pending_ok` | `verified_only`, base radius, expiry).

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js 20.6+ and npm
- Docker and Docker Compose (for local PostGIS database)

### Step 1: Clone and install dependencies
```bash
cd SU_LIST
npm install
```

### Step 2: Configure environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Key defaults in `.env`:
- `ENABLE_DEV_OTP="true"`: displays the 6-digit OTP code on the login screen for testing.
- `ADMIN_PHONES="+923001234567"`: set your test mobile number here to receive admin privileges automatically.
- `ENABLE_IDENTITY_UPLOAD="true"`: allows local testing of private CNIC uploads.

### Step 3: Start the local PostGIS database
```bash
docker compose up -d
```
This starts PostgreSQL 16 with PostGIS on `localhost:5432`.

### Step 4: Run database migrations & seed reference data
```bash
# Apply versioned SQL migrations
npm run migrate

# Seed Lahore categories and 20 major neighbourhoods
npm run seed
```

*(Optional)* To seed fictional demo accounts and jobs labeled `[DEMO]`, set `SEED_DEMO="true"`, `DEMO_CUSTOMER_PHONE="+923000000001"`, and `DEMO_WORKER_PHONE="+923000000002"` in `.env` before running `npm run seed`.

### Step 5: Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Running Tests & Maintenance

```bash
# Run unit tests (phone normalization, state machine, formatters, validation, redaction)
npm test

# Run periodic marketplace maintenance (expires jobs, widens low-bid radius, purges old ID docs)
npm run maintenance
```

---

## 6. Integrations & Production Readiness

| Integration / Service | Status in MVP | Production Requirement |
| :--- | :--- | :--- |
| **Phone OTP Gateway** | Development Mock | Connect an authorized Pakistan SMS provider (e.g. Jazz, Telenor, Twilio) by implementing `OtpProvider` in `src/lib/otp/provider.ts`. |
| **Private Document Storage** | Local Disk (mode `0600`) | Deploy private S3 / GCS bucket with Server-Side Encryption (SSE) and short-lived presigned URLs. Set `STORAGE_DRIVER="s3"`. |
| **Web Push / SMS Notifications** | In-App active; External stubs | In-app notifications are fully operational. Implement push/SMS delivery channels in `src/lib/notify.ts`. |
| **NADRA Verification** | **Intentionally omitted** | The platform does **not** simulate or claim NADRA integration. |

---

## 7. Assumptions & Safety Guardrails

1. **Lahore Pilot Only:** Only the city of Lahore is marked `active: true` in reference data. The database schema permits multi-city scaling in the future (`cities` table), but other cities are intentionally suppressed.
2. **Initial Categories:** Pre-seeded for **Plumbing** and **Electrical** only. Administrators or operators can add categories via database seed or admin queries.
3. **Integer PKR:** All monetary values are integer whole rupees.
4. **Anti-Retaliation Reviews:** Reviews remain hidden until either both parties submit their review or 7 days elapse from booking completion.
5. **Zero Passwords:** No user passwords are stored or required. Accounts authenticate entirely via verified phone numbers and cryptographically signed session tokens.
