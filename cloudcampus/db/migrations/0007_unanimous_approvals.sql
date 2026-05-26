-- Approver-rule revision: events + projects now require UNANIMOUS approval,
-- and any single reject vote immediately rejects the item.
--
--   approved  when approver_pool > 0 AND approvals >= approver_pool
--   rejected  when rejections > 0
--   pending   otherwise (including any revision_requested votes)
--
-- The validator triggers (approver position, current officer, no self-vote,
-- rejection / revision comment required) are unchanged. Existing votes are
-- preserved; the next vote on each pending item re-evaluates against the new
-- rule and may auto-advance it.

CREATE OR REPLACE FUNCTION finalize_event_status() RETURNS trigger AS $$
DECLARE
  sy_id      UUID;
  approvers  INT;
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

  SELECT count(*) INTO approvals
    FROM event_approvals WHERE event_id = NEW.event_id AND decision = 'approved';
  SELECT count(*) INTO rejections
    FROM event_approvals WHERE event_id = NEW.event_id AND decision = 'rejected';

  IF rejections > 0 THEN
    UPDATE events SET status = 'rejected'
      WHERE id = NEW.event_id AND status = 'pending';
  ELSIF approvers > 0 AND approvals >= approvers THEN
    UPDATE events SET status = 'approved', approved_at = now()
      WHERE id = NEW.event_id AND status = 'pending';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finalize_project_status() RETURNS trigger AS $$
DECLARE
  approvers  INT;
  approvals  INT;
  rejections INT;
BEGIN
  SELECT count(*) INTO approvers
    FROM officers o
    JOIN officer_positions p ON p.id = o.position_id
   WHERE o.is_current
     AND p.is_approver;

  SELECT count(*) INTO approvals
    FROM project_approvals
   WHERE project_id = NEW.project_id AND decision = 'approved';
  SELECT count(*) INTO rejections
    FROM project_approvals
   WHERE project_id = NEW.project_id AND decision = 'rejected';

  IF rejections > 0 THEN
    UPDATE projects SET status = 'rejected'
      WHERE id = NEW.project_id AND status = 'pending';
  ELSIF approvers > 0 AND approvals >= approvers THEN
    UPDATE projects SET status = 'approved'
      WHERE id = NEW.project_id AND status = 'pending';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
