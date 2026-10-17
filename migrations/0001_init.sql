-- 0001_init.sql  — Kaam Lahore MVP schema.
-- MONEY: all amounts are INTEGER whole PKR (rupees). No paisa, no floats.
-- TIME:  all timestamps are timestamptz (UTC); displayed in Asia/Karachi by the app.
-- GEO:   PostGIS geography(Point,4326). Precise job locations live ONLY in job_private.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Reference data ----------
CREATE TABLE cities (
  id          smallserial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Karachi',
  active      boolean NOT NULL DEFAULT false   -- only Lahore is active in the MVP
);

CREATE TABLE service_categories (
  id          smallserial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  name_ur     text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  smallint NOT NULL DEFAULT 0
);

CREATE TABLE service_areas (
  id          serial PRIMARY KEY,
  city_id     smallint NOT NULL REFERENCES cities(id),
  name        text NOT NULL,
  name_ur     text,
  centroid    geography(Point,4326) NOT NULL,
  boundary    geography(Polygon,4326),          -- optional
  active      boolean NOT NULL DEFAULT true,
  UNIQUE (city_id, name)
);
CREATE INDEX service_areas_centroid_gix ON service_areas USING gist (centroid);

-- ---------- Users & auth ----------
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned');

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone              text NOT NULL,                         -- E.164, e.g. +923001234567
  phone_verified_at  timestamptz,
  display_name       text,
  is_customer        boolean NOT NULL DEFAULT true,
  is_worker          boolean NOT NULL DEFAULT false,
  is_admin           boolean NOT NULL DEFAULT false,
  account_status     account_status NOT NULL DEFAULT 'active',
  status_reason      text,
  suspended_until    timestamptz,
  notification_prefs jsonb NOT NULL DEFAULT '{"in_app":true,"push":false,"sms":false}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
-- A phone can be reused only after the earlier account was anonymised (deleted_at set, phone cleared).
CREATE UNIQUE INDEX users_phone_uq ON users (phone) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,                         -- sha256 of cookie token
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE otp_codes (
  id           bigserial PRIMARY KEY,
  phone        text NOT NULL,
  code_hash    text NOT NULL,                               -- HMAC, never the code itself
  attempts     smallint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz
);
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

CREATE TABLE rate_limits (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- ---------- Worker profile ----------
CREATE TYPE identity_status AS ENUM
  ('not_submitted', 'pending_review', 'verified', 'rejected', 'needs_resubmission');

CREATE TABLE worker_profiles (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio              text NOT NULL DEFAULT '',
  experience_years smallint CHECK (experience_years BETWEEN 0 AND 60),
  accepting_bids   boolean NOT NULL DEFAULT true,
  identity_status  identity_status NOT NULL DEFAULT 'not_submitted',
  is_demo          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- rating_summary and completed_jobs_count are computed from reviews/bookings at read time
-- (see src/lib/reputation.ts) so they can never drift from the source rows.

CREATE TABLE worker_categories (
  user_id     uuid NOT NULL REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  category_id smallint NOT NULL REFERENCES service_categories(id),
  PRIMARY KEY (user_id, category_id)
);
CREATE TABLE worker_areas (
  user_id uuid NOT NULL REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  area_id integer NOT NULL REFERENCES service_areas(id),
  PRIMARY KEY (user_id, area_id)
);
CREATE INDEX worker_areas_area_idx ON worker_areas (area_id);

-- Raw identity document. The file lives in PRIVATE storage; only a storage key is kept here.
-- Full CNIC numbers are deliberately NOT collected or stored.
CREATE TABLE identity_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key     text,                                     -- null after secure deletion
  document_type   text NOT NULL CHECK (document_type IN ('cnic_front','cnic_back','selfie_with_cnic')),
  mime_type       text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES users(id),
  review_note     text,
  delete_after    timestamptz,                              -- retention deadline
  deleted_at      timestamptz
);
CREATE INDEX identity_documents_user_idx ON identity_documents (user_id);
CREATE INDEX identity_documents_retention_idx ON identity_documents (delete_after) WHERE deleted_at IS NULL;

-- ---------- Jobs ----------
CREATE TYPE job_status AS ENUM
  ('draft','open','awarded','in_progress','completion_requested','completed','disputed','cancelled','expired');

CREATE TABLE jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES users(id),
  category_id     smallint NOT NULL REFERENCES service_categories(id),
  area_id         integer NOT NULL REFERENCES service_areas(id),  -- PUBLIC coarse location
  title           text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description     text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  budget_min      integer CHECK (budget_min IS NULL OR budget_min > 0),
  budget_max      integer CHECK (budget_max IS NULL OR budget_max > 0),
  asap            boolean NOT NULL DEFAULT false,
  preferred_at    timestamptz,
  status          job_status NOT NULL DEFAULT 'open',
  hidden_at       timestamptz,                              -- moderation
  is_demo         boolean NOT NULL DEFAULT false,
  match_radius_km numeric(5,1) NOT NULL DEFAULT 3,
  match_stage     smallint NOT NULL DEFAULT 0,
  last_expanded_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  expires_at      timestamptz NOT NULL,
  CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min),
  CHECK (asap OR preferred_at IS NOT NULL)
);
CREATE INDEX jobs_customer_idx ON jobs (customer_id, created_at DESC);
CREATE INDEX jobs_open_idx ON jobs (category_id, area_id, created_at DESC) WHERE status = 'open';
CREATE INDEX jobs_status_expiry_idx ON jobs (status, expires_at);

-- PRIVATE: exact address, contact note and precise pin. Never selected by public/bidder queries.
CREATE TABLE job_private (
  job_id        uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  address_text  text NOT NULL CHECK (char_length(address_text) BETWEEN 5 AND 300),
  contact_note  text,
  precise_point geography(Point,4326)
);
CREATE INDEX job_private_point_gix ON job_private USING gist (precise_point);

CREATE TABLE job_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES users(id),
  storage_key text NOT NULL,
  mime_type   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_photos_job_idx ON job_photos (job_id);

CREATE TABLE worker_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  mime_type   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Bids & bookings ----------
CREATE TYPE bid_status AS ENUM ('active','withdrawn','accepted','rejected','expired');

CREATE TABLE bids (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id    uuid NOT NULL REFERENCES users(id),
  amount       integer NOT NULL CHECK (amount BETWEEN 100 AND 10000000),  -- whole PKR, labour only
  timing_text  text NOT NULL CHECK (char_length(timing_text) BETWEEN 3 AND 120),
  message      text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 800),
  inclusions   text NOT NULL DEFAULT '' CHECK (char_length(inclusions) <= 500),
  exclusions   text NOT NULL DEFAULT '' CHECK (char_length(exclusions) <= 500),
  status       bid_status NOT NULL DEFAULT 'active',
  hidden_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- One live bid per worker per job (a withdrawn bid can be replaced by re-bidding).
CREATE UNIQUE INDEX bids_one_live_per_worker ON bids (job_id, worker_id)
  WHERE status IN ('active','accepted');
CREATE INDEX bids_worker_idx ON bids (worker_id, created_at DESC);
CREATE INDEX bids_job_idx ON bids (job_id, status);
-- At most ONE accepted bid per job, enforced by the database.
CREATE UNIQUE INDEX bids_one_accepted_per_job ON bids (job_id) WHERE status = 'accepted';

CREATE TABLE bookings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                   uuid NOT NULL UNIQUE REFERENCES jobs(id),
  customer_id              uuid NOT NULL REFERENCES users(id),
  worker_id                uuid NOT NULL REFERENCES users(id),
  accepted_bid_id          uuid NOT NULL UNIQUE REFERENCES bids(id),
  status                   job_status NOT NULL DEFAULT 'awarded'
                             CHECK (status IN ('awarded','in_progress','completion_requested','completed','disputed','cancelled')),
  completion_code_hash     text,                             -- HMAC of the optional completion code
  completion_code_attempts smallint NOT NULL DEFAULT 0,
  selected_at              timestamptz NOT NULL DEFAULT now(),
  started_at               timestamptz,
  completion_requested_at  timestamptz,
  completed_at             timestamptz,
  CHECK (customer_id <> worker_id)
);
CREATE INDEX bookings_customer_idx ON bookings (customer_id);
CREATE INDEX bookings_worker_idx ON bookings (worker_id);

CREATE TABLE job_status_log (
  id          bigserial PRIMARY KEY,
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  from_status job_status,
  to_status   job_status NOT NULL,
  actor_id    uuid REFERENCES users(id),                     -- null = system
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_status_log_job_idx ON job_status_log (job_id, created_at);

-- ---------- Reviews ----------
CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id),
  reviewer_id uuid NOT NULL REFERENCES users(id),
  reviewee_id uuid NOT NULL REFERENCES users(id),
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  status      text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  hidden_reason text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewer_id <> reviewee_id),
  UNIQUE (booking_id, reviewer_id)                           -- one review per participant per booking
);
CREATE INDEX reviews_reviewee_idx ON reviews (reviewee_id);

-- ---------- Moderation ----------
CREATE TYPE report_target AS ENUM ('user','job','bid','review','booking');
CREATE TYPE report_category AS ENUM
  ('spam','no_show','harassment','suspected_fraud','unsafe_conduct','misleading_price','inappropriate_content','other');

CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES users(id),
  target_type  report_target NOT NULL,
  target_id    uuid NOT NULL,
  category     report_category NOT NULL,
  details      text CHECK (details IS NULL OR char_length(details) <= 1500),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  internal_notes text,
  resolved_by  uuid REFERENCES users(id),
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_queue_idx ON reports (status, created_at);
-- Prevent the same reporter spamming duplicate open reports on one target.
CREATE UNIQUE INDEX reports_dedupe ON reports (reporter_id, target_type, target_id, category)
  WHERE status = 'open';

CREATE TABLE moderation_actions (
  id           bigserial PRIMARY KEY,
  admin_id     uuid NOT NULL REFERENCES users(id),
  target_type  report_target NOT NULL,
  target_id    uuid NOT NULL,
  report_id    uuid REFERENCES reports(id),
  action       text NOT NULL CHECK (action IN
    ('warn','suspend','ban','reinstate','dismiss_report','hide_job','unhide_job','hide_review','unhide_review','hide_bid','resolve_dispute','verify_identity','reject_identity','request_resubmission')),
  reason       text NOT NULL CHECK (char_length(reason) >= 5),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_actions_target_idx ON moderation_actions (target_type, target_id);

CREATE TABLE appeals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  message    text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1500),
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Notifications, matching analytics, audit ----------
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL,            -- must never contain exact address / phone numbers
  ref_type   text,
  ref_id     uuid,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE match_events (
  id         bigserial PRIMARY KEY,
  job_id     uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id  uuid NOT NULL REFERENCES users(id),
  stage      smallint NOT NULL,
  radius_km  numeric(5,1) NOT NULL,
  channel    text NOT NULL DEFAULT 'in_app',
  delivered  boolean NOT NULL DEFAULT false,   -- true only when a channel confirms delivery
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, worker_id)                   -- a worker is notified of a job once
);
CREATE INDEX match_events_job_idx ON match_events (job_id);

CREATE TABLE audit_logs (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,
  target_type text,
  target_id   text,
  metadata    jsonb NOT NULL DEFAULT '{}',     -- SAFE metadata only (see src/lib/audit.ts)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);

CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE deletion_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','blocked_active_booking'))
);
