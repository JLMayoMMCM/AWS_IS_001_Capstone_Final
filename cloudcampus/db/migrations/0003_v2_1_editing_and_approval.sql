-- V2.1: editing + re-approval, multi-incumbent positions, 2/3 event approval,
-- unique student IDs, date-only announcements, drop site_settings.term,
-- project published_url.
--
-- Companion: Docs/V2.1_Implementation_Plan.md. Each section maps to a phase.

-- ===========================================================================
-- Phase 0.1 — multi-incumbent officer positions
-- ===========================================================================

-- Add the per-position cap. Existing singletons keep their cap of 1.
ALTER TABLE officer_positions
  ADD COLUMN max_incumbents INTEGER NOT NULL DEFAULT 1
    CHECK (max_incumbents >= 1);

-- Drop the V2 singleton machinery now that max_incumbents replaces it.
DROP TRIGGER IF EXISTS officers_enforce_singleton ON officers;
DROP FUNCTION IF EXISTS enforce_singleton_officer();
ALTER TABLE officer_positions DROP COLUMN IF EXISTS is_singleton;

-- Enforce the cap on each newly-current officer row. The cap is per
-- (position, school_year, is_current) — i.e. only the active term is gated.
-- Defense-in-depth: the API also pre-checks before insert.
CREATE OR REPLACE FUNCTION enforce_officer_cap() RETURNS trigger AS $$
DECLARE
  cap INT;
  used INT;
BEGIN
  IF NOT NEW.is_current THEN
    RETURN NEW;
  END IF;
  SELECT max_incumbents INTO cap FROM officer_positions WHERE id = NEW.position_id;
  IF cap IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO used FROM officers
    WHERE position_id = NEW.position_id
      AND school_year_id = NEW.school_year_id
      AND is_current
      AND id <> NEW.id;
  IF used >= cap THEN
    RAISE EXCEPTION
      'position % is at capacity (% of % filled for this school year)',
      NEW.position_id, used + 1, cap;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER officers_enforce_cap
  BEFORE INSERT OR UPDATE ON officers
  FOR EACH ROW EXECUTE FUNCTION enforce_officer_cap();

-- ===========================================================================
-- Phase 0.2 — event approval rework (2/3 majority, min 2, revision_requested)
-- ===========================================================================

-- Drop the V1 "exactly 3 approvers" guard so multi-position approver pools
-- are allowed. The new finalize_event_status uses ceil(2/3) with min 2.
DROP TRIGGER IF EXISTS officer_positions_three_approvers ON officer_positions;
DROP FUNCTION IF EXISTS enforce_three_approvers();

-- Expand the decision domain: revision_requested joins approved + rejected.
ALTER TABLE event_approvals
  DROP CONSTRAINT IF EXISTS event_approvals_decision_check;
ALTER TABLE event_approvals
  ADD CONSTRAINT event_approvals_decision_check
  CHECK (decision IN ('approved', 'rejected', 'revision_requested'));

-- Replace the validator: revision_requested votes also require a comment.
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

  IF NEW.decision IN ('rejected', 'revision_requested')
     AND (NEW.comment IS NULL OR btrim(NEW.comment) = '') THEN
    RAISE EXCEPTION '% requires a non-empty comment', NEW.decision;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Replace the finalizer:
--   approver_pool   = count of officer rows in the event's school year whose
--                     position has is_approver = TRUE and is_current = TRUE
--   threshold       = GREATEST(2, CEIL(2 * approver_pool / 3))
--   approved        when approvals >= threshold
--   rejected        when approver_pool - reject_votes < threshold  (math-imp)
--   revision_requested votes do not move status; they're a soft signal.
CREATE OR REPLACE FUNCTION finalize_event_status() RETURNS trigger AS $$
DECLARE
  sy_id      UUID;
  approvers  INT;
  threshold  INT;
  approvals  INT;
  rejections INT;
BEGIN
  SELECT school_year_id INTO sy_id FROM events WHERE id = NEW.event_id;

  SELECT count(*) INTO approvers
    FROM officers o
    JOIN officer_positions p ON p.id = o.position_id
   WHERE o.is_current
     AND o.school_year_id = sy_id
     AND p.is_approver;

  threshold := GREATEST(2, CEIL(2.0 * approvers / 3.0)::INT);

  SELECT count(*) INTO approvals
    FROM event_approvals WHERE event_id = NEW.event_id AND decision = 'approved';
  SELECT count(*) INTO rejections
    FROM event_approvals WHERE event_id = NEW.event_id AND decision = 'rejected';

  IF approvals >= threshold THEN
    UPDATE events SET status = 'approved', approved_at = now()
      WHERE id = NEW.event_id AND status = 'pending';
  ELSIF approvers - rejections < threshold THEN
    UPDATE events SET status = 'rejected'
      WHERE id = NEW.event_id AND status = 'pending';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- The validator + finalizer triggers are unchanged in name; CREATE OR REPLACE
-- on the FUNCTION above already swapped the body.

-- ===========================================================================
-- Phase 0.3 — edit + re-approval timestamps on blogs, projects, events
-- ===========================================================================

ALTER TABLE blogs    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE blogs    ADD COLUMN IF NOT EXISTS previous_published_at TIMESTAMPTZ;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS previous_published_at TIMESTAMPTZ;

ALTER TABLE events   ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- ===========================================================================
-- Phase 0.4 — unique identity (student_id across registration_requests)
-- ===========================================================================

-- members.student_id is already UNIQUE (see 0001 line 92).
-- registration_requests.email already has a partial unique index from V2.
-- Add the same shape for student_id so pending applications can't reuse one.
CREATE UNIQUE INDEX IF NOT EXISTS registration_requests_active_student_id
  ON registration_requests (student_id)
  WHERE student_id IS NOT NULL AND status <> 'rejected';

-- ===========================================================================
-- Phase 0.5 — date-only announcements
-- ===========================================================================

-- expires_at / pinned_until / published_at lose their time-of-day component.
-- The existing CHECK (expires_at > published_at) still holds under DATE.
ALTER TABLE announcements
  ALTER COLUMN published_at TYPE DATE USING published_at::date,
  ALTER COLUMN expires_at   TYPE DATE USING expires_at::date,
  ALTER COLUMN pinned_until TYPE DATE USING pinned_until::date;

-- Re-default published_at to today (was now()).
ALTER TABLE announcements ALTER COLUMN published_at SET DEFAULT current_date;

-- The feed index used now() in its WHERE clause (V2). PostgreSQL requires
-- index predicates to be IMMUTABLE, so drop the time-based filter — the feed
-- query in lib/queries.ts filters expired items at query time instead.
DROP INDEX IF EXISTS announcements_feed_idx;
CREATE INDEX announcements_feed_idx
  ON announcements (audience, published_at DESC);

-- ===========================================================================
-- Phase 0.6 — site_settings: drop free-text term (school year is canonical)
-- ===========================================================================

ALTER TABLE site_settings DROP COLUMN IF EXISTS term;

-- ===========================================================================
-- Phase 0.7 — projects: optional published URL
-- ===========================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS published_url TEXT;
