# Supabase Cloud Database & Storage Integration Guide

This guide covers how **Maddad Lahore (مدد لاہور)** integrates with **Supabase** for real-time lead capture, cloud PostgreSQL database hosting, and private object storage.

---

## 1. Architecture Overview

Maddad Lahore features a resilient **hybrid cloud architecture**:

```
 ┌────────────────────────────────────────────────────────┐
 │            Maddad Lahore Next.js 14 App                │
 └──────────┬───────────────────────────────┬─────────────┘
            │                               │
            ▼                               ▼
 ┌──────────────────────┐        ┌─────────────────────────┐
 │ Supabase Cloud REST  │        │ PostgreSQL / PostGIS    │
 │   & Storage SDK      │        │ Direct Connection (Pool)│
 ├──────────────────────┤        ├─────────────────────────┤
 │ • public.signups     │        │ • users, worker_profiles│
 │ • public.job_leads   │        │ • jobs, job_private     │
 │ • public.bids_activity│       │ • bids, bookings        │
 │ • private buckets    │        │ • reviews, reports      │
 └──────────────────────┘        └─────────────────────────┘
```

1. **Lead Capture & Signups (REST SDK)**: Captures user registrations (`signups`), customer job requests (`job_leads`), and technician bidding activity (`bids_activity`) into Supabase in real-time, even when running serverless on Vercel or without local Docker.
2. **Direct Cloud Database (PostgreSQL + PostGIS)**: By providing `DATABASE_URL` pointing to your Supabase project (direct port `5432` or Supabase pooler `6543`), the entire core marketplace relational database runs directly on Supabase.
3. **Private Object Storage**: Encrypted buckets (`job-photos`, `worker-photos`, `identity`) store private user photos and CNIC verification files with zero public direct URLs.
4. **Offline Resilient**: If Supabase credentials are not yet configured, the app operates automatically with in-memory domain storage, ensuring zero downtime.

---

## 2. Step-by-Step Setup

### Step 1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **New project**.
2. Name your project (e.g. `maddad-lahore`), select a database password, and choose a region close to your target audience (e.g., `Singapore` or `Frankfurt`).

### Step 2: Retrieve API Keys
In your Supabase dashboard:
1. Navigate to **Project Settings &rarr; API**.
2. Copy your **Project URL** (e.g. `https://xyzcompany.supabase.co`).
3. Copy your `anon` `public` key.
4. Under **Project API keys**, reveal and copy your `service_role` secret key.

### Step 3: Configure Environment Variables
Open `.env.local` in the project root and fill in the Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
```

*(Optional)* To use Supabase Storage for private photos and CNIC uploads:
```bash
STORAGE_DRIVER="supabase"
```

*(Optional)* To run the entire core database directly against Supabase:
```bash
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres?sslmode=require"
```

---

## 3. Run the Database Migration

### Option A: Via Supabase Web Dashboard (Easiest)
1. In your Supabase Dashboard, open the **SQL Editor** from the left navigation bar.
2. Click **New query**.
3. Open [`migrations/supabase_setup.sql`](../migrations/supabase_setup.sql) in this repository, copy its entire contents, paste them into the SQL Editor, and click **Run**.
4. To apply the complete relational marketplace schema (jobs, bids, bookings, reviews), copy and run [`migrations/0001_init.sql`](../migrations/0001_init.sql).

### Option B: Via Terminal Migration Runner
If your `DATABASE_URL` is set to your Supabase connection string:
```bash
npm run migrate
npm run seed
```

---

## 4. Supabase Storage Buckets

The migration script automatically registers the required private buckets in Supabase Storage:
- `job-photos`: Photos attached to customer job posts (max 1.5MB, JPEG/PNG/WebP, EXIF metadata stripped).
- `worker-photos`: Portfolio photos for technician profiles.
- `identity`: Private CNIC verification documents reviewed only by administrators.

All buckets are configured with `public: false` to ensure files can never be accessed via direct public links. They are served exclusively through authorized route handlers (`/files/*`).

---

## 5. Verification & Health Monitoring

1. **Admin Hub**: Sign in with an admin phone number (configured in `ADMIN_PHONES`, e.g. `0300 1234567`) and open `/admin`.
   - The **Supabase Cloud Database & Leads Hub** section will show a green **Connected** badge with real-time latency.
   - It will display live lists of all captured user signups and customer job leads.
2. **API Endpoint**: Test the health check endpoint directly:
   ```bash
   curl http://localhost:3000/api/supabase/status
   ```
   Returns:
   ```json
   {
     "configured": true,
     "connected": true,
     "url": "https://xyzcompany.supabase.co",
     "latencyMs": 85,
     "tables": {
       "signups": true,
       "job_leads": true,
       "bids_activity": true
     },
     "counts": {
       "signups": 4,
       "jobLeads": 2,
       "bids": 5
     }
   }
   ```
