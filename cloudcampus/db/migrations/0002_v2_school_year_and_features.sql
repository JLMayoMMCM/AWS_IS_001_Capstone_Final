-- CloudCampus V2 — school-year lifecycle, registration, password reset,
-- announcements, push notifications, blog approval, singleton officer rule.
-- Adds tables and columns; keeps every V1 column intact (term_label is
-- retained as a denormalised label maintained by a trigger).

-- ---------------------------------------------------------------------------
-- 0.1 school_years — the spine
-- ---------------------------------------------------------------------------
CREATE TABLE school_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_year  INTEGER NOT NULL,
  end_year    INTEGER NOT NULL,
  label       TEXT GENERATED ALWAYS AS
                (start_year::text || '-' || end_year::text) STORED,
  starts_on   DATE NOT NULL,
  ends_on     DATE NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_years_year_order  CHECK (end_year = start_year + 1),
  CONSTRAINT school_years_date_order  CHECK (ends_on > starts_on),
  CONSTRAINT school_years_unique_range UNIQUE (start_year, end_year)
);
CREATE UNIQUE INDEX school_years_one_current
  ON school_years (is_current) WHERE is_current;

-- Seed: derive one school year from the existing site_settings.term value.
-- The term is a free-text label (e.g. "2026" or "2026-2027"). We extract the
-- first 4-digit year and create the (start_year, start_year + 1) row.
DO $$
DECLARE
  raw_term TEXT;
  sy_start INTEGER;
BEGIN
  SELECT term INTO raw_term FROM site_settings WHERE id = TRUE;
  sy_start := COALESCE(
    NULLIF(substring(COALESCE(raw_term, '') FROM '\d{4}'), '')::INTEGER,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  );

  INSERT INTO school_years (start_year, end_year, starts_on, ends_on, is_current)
  VALUES (
    sy_start,
    sy_start + 1,
    make_date(sy_start,     8, 1),  -- conventional Aug 1 start
    make_date(sy_start + 1, 7, 31), -- conventional Jul 31 end
    TRUE
  )
  ON CONFLICT (start_year, end_year) DO NOTHING;
END$$;

-- ---------------------------------------------------------------------------
-- 0.2 Wire school_year_id into officers and members
-- ---------------------------------------------------------------------------
ALTER TABLE officers
  ADD COLUMN school_year_id UUID REFERENCES school_years(id) ON DELETE RESTRICT;

ALTER TABLE members
  ADD COLUMN school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL;

-- Backfill: every existing officer belongs to the seeded current SY.
UPDATE officers
   SET school_year_id = (SELECT id FROM school_years WHERE is_current);

UPDATE members
   SET school_year_id = (SELECT id FROM school_years WHERE is_current)
 WHERE school_year_id IS NULL;

ALTER TABLE officers
  ALTER COLUMN school_year_id SET NOT NULL;

CREATE INDEX officers_school_year_idx ON officers (school_year_id);
CREATE INDEX members_school_year_idx ON members (school_year_id);

-- Keep officers.term_label / term_start / term_end in sync with school_years
-- on every insert and on updates that change the FK. The SY foreign key is
-- the source of truth; the inline label is a denormalised convenience.
CREATE OR REPLACE FUNCTION officers_sync_term_from_school_year()
RETURNS trigger AS $$
DECLARE
  sy RECORD;
BEGIN
  SELECT label, starts_on, ends_on INTO sy
    FROM school_years WHERE id = NEW.school_year_id;
  IF sy IS NULL THEN
    RAISE EXCEPTION 'school_year_id % does not exist', NEW.school_year_id;
  END IF;
  NEW.term_label := sy.label;
  NEW.term_start := COALESCE(NEW.term_start, sy.starts_on);
  -- term_end stays NULL while is_current; ended terms keep whatever the
  -- application sets (or fall back to the SY's end date).
  IF NEW.is_current THEN
    NEW.term_end := NULL;
  ELSE
    NEW.term_end := COALESCE(NEW.term_end, sy.ends_on);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER officers_term_sync
  BEFORE INSERT OR UPDATE OF school_year_id, is_current ON officers
  FOR EACH ROW EXECUTE FUNCTION officers_sync_term_from_school_year();

-- ---------------------------------------------------------------------------
-- 0.3 member_school_years — historical roster snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE member_school_years (
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  status_id      UUID REFERENCES member_statuses(id) ON DELETE SET NULL,
  year_level_id  UUID REFERENCES year_levels(id) ON DELETE SET NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, school_year_id)
);
CREATE INDEX member_school_years_sy_idx
  ON member_school_years (school_year_id);

-- Seed the current SY's snapshot from the live roster.
INSERT INTO member_school_years (member_id, school_year_id, status_id, year_level_id)
SELECT m.id, (SELECT id FROM school_years WHERE is_current),
       m.status_id, m.year_level_id
  FROM members m
ON CONFLICT (member_id, school_year_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 0.4 Singleton officer positions (President, Vice President, Secretary)
-- ---------------------------------------------------------------------------
ALTER TABLE officer_positions
  ADD COLUMN is_singleton BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed the singletons by name where they exist; harmless when they don't.
UPDATE officer_positions
   SET is_singleton = TRUE
 WHERE name IN ('President', 'Vice President', 'Secretary');

-- A singleton position can hold at most one current officer per school year.
-- PostgreSQL doesn't allow subqueries in partial-index predicates, so a
-- BEFORE trigger does the enforcement.
CREATE OR REPLACE FUNCTION enforce_singleton_officer()
RETURNS trigger AS $$
DECLARE
  is_singleton BOOLEAN;
  conflict_count INTEGER;
BEGIN
  IF NOT NEW.is_current THEN
    RETURN NEW;
  END IF;
  SELECT op.is_singleton INTO is_singleton
    FROM officer_positions op WHERE op.id = NEW.position_id;
  IF NOT is_singleton THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO conflict_count
    FROM officers
   WHERE position_id    = NEW.position_id
     AND school_year_id = NEW.school_year_id
     AND is_current
     AND id <> NEW.id;
  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'position % is a singleton and already has a current officer for this school year',
      NEW.position_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER officers_enforce_singleton
  BEFORE INSERT OR UPDATE ON officers
  FOR EACH ROW EXECUTE FUNCTION enforce_singleton_officer();

-- ---------------------------------------------------------------------------
-- 1. registration_requests — public sign-up queue, admin-approved
-- ---------------------------------------------------------------------------
CREATE TYPE registration_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE registration_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  student_id      TEXT,
  course_id       UUID REFERENCES courses(id) ON DELETE SET NULL,
  year_level_id   UUID REFERENCES year_levels(id) ON DELETE SET NULL,
  school_year_id  UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  status          registration_status NOT NULL DEFAULT 'pending',
  rejection_note  TEXT,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One pending or approved request per email; rejected emails may re-apply.
CREATE UNIQUE INDEX registration_requests_active_email
  ON registration_requests (lower(email))
  WHERE status IN ('pending', 'approved');
CREATE INDEX registration_requests_status_idx
  ON registration_requests (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. password_reset_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, expires_at DESC);
CREATE UNIQUE INDEX password_reset_tokens_hash_idx
  ON password_reset_tokens (token_hash);

-- ---------------------------------------------------------------------------
-- 4. announcements
-- ---------------------------------------------------------------------------
CREATE TYPE announcement_level    AS ENUM ('normal', 'elevated', 'critical');
CREATE TYPE announcement_audience AS ENUM ('public', 'members', 'officers');

CREATE TABLE announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  level         announcement_level    NOT NULL DEFAULT 'normal',
  audience      announcement_audience NOT NULL DEFAULT 'members',
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  pinned_until  TIMESTAMPTZ,
  author_id     UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  push_sent_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT announcements_expires_after_published
    CHECK (expires_at IS NULL OR expires_at > published_at)
);
CREATE INDEX announcements_feed_idx
  ON announcements (audience, published_at DESC);
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Per-user dismissals so the banner can hide acknowledged items.
CREATE TABLE announcement_dismissals (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

-- ---------------------------------------------------------------------------
-- 5. Push notifications: subscriptions, preferences, outbox
-- ---------------------------------------------------------------------------
CREATE TABLE push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT UNIQUE NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

CREATE TABLE notification_preferences (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_events        BOOLEAN NOT NULL DEFAULT TRUE,
  notify_forms         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_blogs         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_announcements BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE notification_outbox (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('event','form','blog','announcement')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link        TEXT,
  sent_at     TIMESTAMPTZ,
  failure     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notification_outbox_pending_idx
  ON notification_outbox (sent_at) WHERE sent_at IS NULL;

-- A default preferences row for every existing user; new users get one on
-- their first preferences-page visit (the route upserts).
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
