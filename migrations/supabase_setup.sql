-- ==============================================================================
-- Supabase Setup & Cloud Database Schema for Maddad Lahore (مدد لاہور)
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Signups Data Collection Table (Captures leads, new user registrations, and roles)
CREATE TABLE IF NOT EXISTS public.signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'technician')),
  trade TEXT,
  area TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_signups_phone ON public.signups(phone);
CREATE INDEX IF NOT EXISTS idx_signups_created_at ON public.signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signups_role ON public.signups(role);

-- 3. Job Leads Data Collection Table (Captures customer job posts and estimates)
CREATE TABLE IF NOT EXISTS public.job_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  area TEXT NOT NULL,
  budget_min INTEGER,
  budget_max INTEGER,
  customer_phone TEXT,
  address_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_leads_created_at ON public.job_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_leads_area ON public.job_leads(area);
CREATE INDEX IF NOT EXISTS idx_job_leads_category ON public.job_leads(category);

-- 4. Bids Activity Log Table (Captures technician quoting & marketplace activity)
CREATE TABLE IF NOT EXISTS public.bids_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  worker_phone TEXT NOT NULL,
  amount INTEGER NOT NULL,
  timing_text TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bids_activity_created_at ON public.bids_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_activity_job_id ON public.bids_activity(job_id);

-- 5. Row Level Security (RLS) Configuration
ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids_activity ENABLE ROW LEVEL SECURITY;

-- Anonymous and Authenticated users can insert leads/signups/bids
DROP POLICY IF EXISTS "Allow public insert to signups" ON public.signups;
CREATE POLICY "Allow public insert to signups"
  ON public.signups FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access to signups" ON public.signups;
CREATE POLICY "Allow service role full access to signups"
  ON public.signups FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert to job_leads" ON public.job_leads;
CREATE POLICY "Allow public insert to job_leads"
  ON public.job_leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access to job_leads" ON public.job_leads;
CREATE POLICY "Allow service role full access to job_leads"
  ON public.job_leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert to bids_activity" ON public.bids_activity;
CREATE POLICY "Allow public insert to bids_activity"
  ON public.bids_activity FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access to bids_activity" ON public.bids_activity;
CREATE POLICY "Allow service role full access to bids_activity"
  ON public.bids_activity FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 6. Storage Buckets for Private Cloud Storage (photos & identity verification)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES 
      ('job-photos', 'job-photos', false, 1500000, ARRAY['image/jpeg', 'image/png', 'image/webp']),
      ('worker-photos', 'worker-photos', false, 1500000, ARRAY['image/jpeg', 'image/png', 'image/webp']),
      ('identity', 'identity', false, 5000000, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Storage extension might be managed differently in some tiers
  NULL;
END $$;

-- 7. Enable Realtime Replication for Admin Dashboards
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.signups;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_leads;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bids_activity;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- End of Supabase setup script
