-- V2.1 §extension: project voting mirrors event voting (2/3 majority, min 2,
-- revision_requested decision, no self-vote, comment required for reject /
-- revision). Replaces the admin-only single-action approval on
-- /api/admin/projects/[id]/status — that endpoint remains for the archive
-- action and admin override of the auto status advance.

CREATE TABLE IF NOT EXISTS project_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES officer_positions(id) ON DELETE RESTRICT,
  officer_id  UUID NOT NULL REFERENCES officers(id) ON DELETE RESTRICT,
  decision    TEXT NOT NULL
              CHECK (decision IN ('approved', 'rejected', 'revision_requested')),
  comment     TEXT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One vote per position per project — DR-05 equivalent for projects.
  CONSTRAINT project_approvals_one_vote_per_position UNIQUE (project_id, position_id)
);
CREATE INDEX IF NOT EXISTS project_approvals_project_idx
  ON project_approvals (project_id);

-- Validate each vote: position must be approver, officer must be current,
-- no self-vote, reject / revision needs a comment.
CREATE OR REPLACE FUNCTION validate_project_approval() RETURNS trigger AS $$
DECLARE
  position_is_approver BOOLEAN;
  voter_member_id      UUID;
  voter_is_current     BOOLEAN;
  project_creator_id   UUID;
BEGIN
  SELECT is_approver INTO position_is_approver
    FROM officer_positions WHERE id = NEW.position_id;
  IF NOT position_is_approver THEN
    RAISE EXCEPTION 'position % is not an approver position', NEW.position_id;
  END IF;

  SELECT member_id, is_current INTO voter_member_id, voter_is_current
    FROM officers WHERE id = NEW.officer_id;
  IF voter_member_id IS NULL THEN
    RAISE EXCEPTION 'officer % does not exist', NEW.officer_id;
  END IF;
  IF NOT voter_is_current THEN
    RAISE EXCEPTION 'officer % is not a current officer', NEW.officer_id;
  END IF;

  SELECT submitted_by INTO project_creator_id FROM projects WHERE id = NEW.project_id;
  IF project_creator_id = voter_member_id THEN
    RAISE EXCEPTION 'an officer cannot vote on a project they submitted';
  END IF;

  IF NEW.decision IN ('rejected', 'revision_requested')
     AND (NEW.comment IS NULL OR btrim(NEW.comment) = '') THEN
    RAISE EXCEPTION '% requires a non-empty comment', NEW.decision;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_approvals_validate ON project_approvals;
CREATE TRIGGER project_approvals_validate BEFORE INSERT ON project_approvals
  FOR EACH ROW EXECUTE FUNCTION validate_project_approval();

-- Advance project status as votes land. Threshold = GREATEST(2, CEIL(2*P/3))
-- where P = approver-position officers currently in the school year derived
-- from the SUBMITTER's most recent school-year-marked officer assignment, or
-- (fallback) the count of approver officers currently `is_current` across all
-- school years. Projects, unlike events, don't store a school_year_id, so we
-- use the current officer pool.
CREATE OR REPLACE FUNCTION finalize_project_status() RETURNS trigger AS $$
DECLARE
  approvers  INT;
  threshold  INT;
  approvals  INT;
  rejections INT;
BEGIN
  SELECT count(*) INTO approvers
    FROM officers o
    JOIN officer_positions p ON p.id = o.position_id
   WHERE o.is_current
     AND p.is_approver;

  threshold := GREATEST(2, CEIL(2.0 * approvers / 3.0)::INT);

  SELECT count(*) INTO approvals
    FROM project_approvals WHERE project_id = NEW.project_id AND decision = 'approved';
  SELECT count(*) INTO rejections
    FROM project_approvals WHERE project_id = NEW.project_id AND decision = 'rejected';

  IF approvals >= threshold THEN
    UPDATE projects SET status = 'approved'
      WHERE id = NEW.project_id AND status = 'pending';
  ELSIF approvers - rejections < threshold THEN
    UPDATE projects SET status = 'rejected'
      WHERE id = NEW.project_id AND status = 'pending';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_approvals_finalize ON project_approvals;
CREATE TRIGGER project_approvals_finalize AFTER INSERT ON project_approvals
  FOR EACH ROW EXECUTE FUNCTION finalize_project_status();
