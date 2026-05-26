-- CloudCampus — initial database schema
-- Source of truth: Docs/AWS_Feasibility_Framework.md §6.3 and Docs/SRS §3.5.
-- Target: PostgreSQL 16 (local Docker or Amazon RDS).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email columns

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
-- member_status and form_provider are lookup tables, not enums — see below.
CREATE TYPE user_role      AS ENUM ('guest', 'member', 'officer', 'admin');
CREATE TYPE blog_status    AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE project_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'archived');
CREATE TYPE event_status   AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'completed');
CREATE TYPE visibility     AS ENUM ('public', 'private');

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep updated_at current
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Lookup tables — the vocabularies managed from the admin Categories page.
-- Foreign keys into these tables use ON DELETE SET NULL, so removing a value
-- clears the references rather than failing. Required values are seeded here.
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE year_levels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO year_levels (name, display_order) VALUES
  ('Year 1', 1), ('Year 2', 2), ('Year 3', 3), ('Year 4', 4);

CREATE TABLE member_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO member_statuses (name, display_order) VALUES
  ('Active', 1), ('For Renewal', 2), ('Inactive', 3), ('Alumni', 4);

CREATE TABLE project_categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);
INSERT INTO project_categories (name) VALUES
  ('Web'), ('Mobile'), ('Cloud'), ('Data & AI'), ('Hardware'), ('Research');

CREATE TABLE form_providers (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);
INSERT INTO form_providers (name) VALUES ('Google'), ('Microsoft');

-- ---------------------------------------------------------------------------
-- users — login identity (DR-01 UUID, DR-02 TIMESTAMPTZ, DR-03 CITEXT email)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                       -- bcrypt, work factor >= 12
  role          user_role NOT NULL DEFAULT 'member',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- members — profile / directory (1:1 with users)
-- ---------------------------------------------------------------------------
CREATE TABLE members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  student_id    TEXT UNIQUE,
  course_id     UUID REFERENCES courses(id) ON DELETE SET NULL,
  year_level_id UUID REFERENCES year_levels(id) ON DELETE SET NULL,
  bio           TEXT,
  photo_s3_key  TEXT,
  contact_email CITEXT,
  status_id     UUID REFERENCES member_statuses(id) ON DELETE SET NULL,
  joined_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER members_set_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- officer_positions — lookup of position titles + event-approver flag
-- ---------------------------------------------------------------------------
CREATE TABLE officer_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  is_approver   BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- DR-06: exactly three positions must have is_approver = TRUE. Enforced by a
-- deferred constraint trigger so a transaction may seed the three at once.
CREATE OR REPLACE FUNCTION enforce_three_approvers() RETURNS trigger AS $$
DECLARE
  approver_count INTEGER;
BEGIN
  SELECT count(*) INTO approver_count FROM officer_positions WHERE is_approver;
  IF approver_count <> 3 THEN
    RAISE EXCEPTION
      'officer_positions must have exactly 3 approver rows (found %)', approver_count;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER officer_positions_three_approvers
  AFTER INSERT OR UPDATE OR DELETE ON officer_positions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_three_approvers();

-- ---------------------------------------------------------------------------
-- officers — officer assignments per term
-- ---------------------------------------------------------------------------
CREATE TABLE officers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES officer_positions(id) ON DELETE RESTRICT,
  term_label    TEXT NOT NULL,
  term_start    DATE NOT NULL,
  term_end      DATE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_current    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX officers_current_idx ON officers (is_current, display_order);

-- ---------------------------------------------------------------------------
-- resource_categories & resources
-- ---------------------------------------------------------------------------
CREATE TABLE resource_categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT
);

CREATE TABLE resources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES resource_categories(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  s3_key      TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  BIGINT NOT NULL,
  visibility  visibility NOT NULL DEFAULT 'private',
  uploaded_by UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX resources_category_visibility_idx ON resources (category_id, visibility);
CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- blogs & blog_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE blogs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  body_markdown TEXT NOT NULL,
  cover_s3_key  TEXT,
  status        blog_status NOT NULL DEFAULT 'pending',
  visibility    visibility  NOT NULL DEFAULT 'public',
  approved_by   UUID REFERENCES members(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX blogs_status_visibility_idx ON blogs (status, visibility, published_at DESC);
CREATE TRIGGER blogs_set_updated_at BEFORE UPDATE ON blogs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE blog_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id     UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('image', 'external_link', 'resource_link')),
  s3_key      TEXT,
  url         TEXT,
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  caption     TEXT,
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX blog_attachments_blog_idx ON blog_attachments (blog_id, position);

-- ---------------------------------------------------------------------------
-- projects, project_contributors & project_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT NOT NULL,
  body_markdown TEXT,
  repo_url      TEXT,
  live_url      TEXT,
  tech_stack    TEXT[],
  tags          TEXT[],
  category_id   UUID REFERENCES project_categories(id) ON DELETE SET NULL,
  cover_s3_key  TEXT,
  status        project_status NOT NULL DEFAULT 'pending',
  visibility    visibility NOT NULL DEFAULT 'public',
  submitted_by  UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  approved_by   UUID REFERENCES members(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  started_on    DATE,
  completed_on  DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_status_visibility_idx ON projects (status, visibility, created_at DESC);
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE project_contributors (
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  role_on_project TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, member_id)
);
CREATE INDEX project_contributors_member_idx ON project_contributors (member_id);

CREATE TABLE project_attachments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('image', 'external_link')),
  s3_key     TEXT,
  url        TEXT,
  label      TEXT,
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX project_attachments_project_idx ON project_attachments (project_id, position);

-- ---------------------------------------------------------------------------
-- events & event_approvals
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT NOT NULL,
  body_markdown TEXT,
  cover_s3_key  TEXT,
  location      TEXT,
  location_url  TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  status        event_status NOT NULL DEFAULT 'pending',
  visibility    visibility   NOT NULL DEFAULT 'public',
  created_by    UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_ends_after_starts CHECK (ends_at > starts_at)   -- DR-04
);
CREATE INDEX events_status_starts_idx ON events (status, starts_at);
CREATE INDEX events_visibility_status_starts_idx ON events (visibility, status, starts_at DESC);
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE event_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES officer_positions(id) ON DELETE RESTRICT,
  officer_id  UUID NOT NULL REFERENCES officers(id) ON DELETE RESTRICT,
  decision    TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment     TEXT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_approvals_one_vote_per_position UNIQUE (event_id, position_id)  -- DR-05
);
CREATE INDEX event_approvals_event_idx ON event_approvals (event_id);

-- Validate each vote before it is recorded (FR-OFF-04, FR-OFF-05, FR-OFF-07).
CREATE OR REPLACE FUNCTION validate_event_approval() RETURNS trigger AS $$
DECLARE
  position_is_approver BOOLEAN;
  voter_member_id      UUID;
  voter_is_current     BOOLEAN;
  event_creator_id     UUID;
BEGIN
  SELECT is_approver INTO position_is_approver
    FROM officer_positions WHERE id = NEW.position_id;
  IF NOT position_is_approver THEN
    RAISE EXCEPTION 'position % is not an event-approver position', NEW.position_id;
  END IF;

  SELECT member_id, is_current INTO voter_member_id, voter_is_current
    FROM officers WHERE id = NEW.officer_id;
  IF voter_member_id IS NULL THEN
    RAISE EXCEPTION 'officer % does not exist', NEW.officer_id;
  END IF;
  IF NOT voter_is_current THEN
    RAISE EXCEPTION 'officer % is not a current officer', NEW.officer_id;
  END IF;

  SELECT created_by INTO event_creator_id FROM events WHERE id = NEW.event_id;
  IF event_creator_id = voter_member_id THEN
    RAISE EXCEPTION 'an officer cannot vote on an event they created';
  END IF;

  IF NEW.decision = 'rejected'
     AND (NEW.comment IS NULL OR btrim(NEW.comment) = '') THEN
    RAISE EXCEPTION 'a rejection requires a non-empty comment';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_approvals_validate BEFORE INSERT ON event_approvals
  FOR EACH ROW EXECUTE FUNCTION validate_event_approval();

-- Advance event status as votes land (FR-OFF-06, FR-OFF-07).
CREATE OR REPLACE FUNCTION finalize_event_status() RETURNS trigger AS $$
DECLARE
  approved_count INTEGER;
BEGIN
  IF NEW.decision = 'rejected' THEN
    UPDATE events SET status = 'rejected'
      WHERE id = NEW.event_id AND status = 'pending';
    RETURN NEW;
  END IF;

  SELECT count(*) INTO approved_count
    FROM event_approvals
    WHERE event_id = NEW.event_id AND decision = 'approved';

  IF approved_count >= 3 THEN
    UPDATE events SET status = 'approved', approved_at = now()
      WHERE id = NEW.event_id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_approvals_finalize AFTER INSERT ON event_approvals
  FOR EACH ROW EXECUTE FUNCTION finalize_event_status();

-- ---------------------------------------------------------------------------
-- form_links
-- ---------------------------------------------------------------------------
CREATE TABLE form_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  provider_id   UUID REFERENCES form_providers(id) ON DELETE SET NULL,
  url           TEXT NOT NULL,
  embed_url     TEXT,
  visibility    visibility NOT NULL DEFAULT 'public',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- audit_log — append-only record of sensitive writes (DR-07)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   UUID,
  before_data JSONB,
  after_data  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id, created_at DESC);
CREATE INDEX audit_log_actor_idx  ON audit_log (actor_id, created_at DESC);

-- DR-07: audit_log is append-only. Deny UPDATE and DELETE outright.
CREATE OR REPLACE FUNCTION deny_audit_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_or_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION deny_audit_modification();

-- ---------------------------------------------------------------------------
-- site_settings — the editable organization profile (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE site_settings (
  id              BOOLEAN PRIMARY KEY DEFAULT TRUE,
  org_name        TEXT NOT NULL,
  short_name      TEXT NOT NULL,
  tagline         TEXT NOT NULL,
  about           TEXT[] NOT NULL,
  term            TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  contact_address TEXT NOT NULL,
  contact_hours   TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row only: the primary key can hold a single TRUE.
  CONSTRAINT site_settings_single_row CHECK (id)
);
CREATE TRIGGER site_settings_set_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO site_settings (org_name, short_name, tagline, about, term, contact_email, contact_address, contact_hours)
VALUES
  ('CloudCampus', 'CC', 'Deploy one, configure all the time.',
   ARRAY['CloudCampus is a framework for lightweight organizational website developed in aws environment.'],
   '2026', 'cc@gmail.com', 'CloudCampus', '7:00AM - 5:00PM');