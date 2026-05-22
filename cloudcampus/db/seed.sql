-- CloudCampus — database seed
--
-- Inserts ONE placeholder row per table so a fresh database is queryable and
-- the bootstrap admin exists (FEAS §7.4, §8.3). Run inside a transaction:
-- the officer_positions trigger (exactly 3 approvers) is deferred to COMMIT.
--
-- Two tables deviate from "one row", both forced by the schema's own rules:
--   * officer_positions — 3 rows: DR-06 requires exactly 3 approver positions.
--   * event_approvals   — 0 rows: a valid vote needs an officer who is NOT the
--                         event creator (FR-OFF-05); the single-member seed
--                         org cannot satisfy that. Votes are created at runtime.
--
-- The admin password_hash below is a placeholder; scripts/db-seed.mjs replaces
-- it with a real bcrypt hash of SEED_ADMIN_PASSWORD.

-- users -----------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, role, is_active) VALUES
  ('00000000-0000-0000-0000-0000000000a1',
   'admin@cloudcampus.example', 'PENDING_SEED', 'admin', TRUE);

-- courses (lookup) ------------------------------------------------------------
INSERT INTO courses (name) VALUES ('BS Information Technology');

-- members ---------------------------------------------------------------------
-- Year levels, member statuses, form providers and project categories are
-- seeded by migration 0002; courses are referenced by name below.
INSERT INTO members
  (id, user_id, full_name, student_id, course_id, year_level_id, bio,
   contact_email, status_id)
VALUES
  ('00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1',
   'CloudCampus Administrator', 'STAFF-0001',
   (SELECT id FROM courses WHERE name = 'BS Information Technology'), NULL,
   'Bootstrap administrator account created by the database seed.',
   'admin@cloudcampus.example',
   (SELECT id FROM member_statuses WHERE name = 'Active'));

-- officer_positions (3 approver positions — required by DR-06) -----------------
INSERT INTO officer_positions (id, name, is_approver, display_order) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'President',      TRUE, 1),
  ('00000000-0000-0000-0000-0000000000c2', 'Vice President', TRUE, 2),
  ('00000000-0000-0000-0000-0000000000c3', 'Secretary',      TRUE, 3);

-- officers --------------------------------------------------------------------
INSERT INTO officers
  (id, member_id, position_id, term_label, term_start, is_current)
VALUES
  ('00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000c1',
   'AY 2025-2026', DATE '2025-08-01', TRUE);

-- resource_categories ---------------------------------------------------------
INSERT INTO resource_categories (id, name, icon) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'Onboarding', 'graduation-cap');

-- resources -------------------------------------------------------------------
INSERT INTO resources
  (id, category_id, title, description, s3_key, file_name, mime_type,
   size_bytes, visibility, uploaded_by)
VALUES
  ('00000000-0000-0000-0000-0000000000e2',
   '00000000-0000-0000-0000-0000000000e1',
   'New Member Handbook', 'Orientation guide for new CloudCampus members.',
   'resources/new-member-handbook.pdf', 'new-member-handbook.pdf',
   'application/pdf', 1048576, 'public',
   '00000000-0000-0000-0000-0000000000b1');

-- blogs -----------------------------------------------------------------------
INSERT INTO blogs
  (id, author_id, title, slug, body_markdown, status, visibility,
   approved_by, approved_at, published_at)
VALUES
  ('00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000b1',
   'Welcome to CloudCampus', 'welcome-to-cloudcampus',
   'CloudCampus is now online. This first post marks the launch of the site.',
   'approved', 'public',
   '00000000-0000-0000-0000-0000000000b1', now(), now());

-- blog_attachments ------------------------------------------------------------
INSERT INTO blog_attachments (id, blog_id, kind, url, caption, position) VALUES
  ('00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000f1',
   'external_link', 'https://cloudcampus.example',
   'Organization website', 0);

-- projects --------------------------------------------------------------------
INSERT INTO projects
  (id, title, slug, description, body_markdown, repo_url, tech_stack, tags,
   status, visibility, submitted_by, approved_by, approved_at, started_on)
VALUES
  ('00000000-0000-0000-0000-00000000a001',
   'CloudCampus Website', 'cloudcampus-website',
   'The official CloudCampus web platform.',
   'The CloudCampus website, built with Next.js and PostgreSQL on AWS.',
   'https://github.com/cloudcampus/website',
   ARRAY['Next.js', 'PostgreSQL', 'AWS'], ARRAY['web'],
   'approved', 'public',
   '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000b1', now(), DATE '2026-01-01');

-- project_contributors --------------------------------------------------------
INSERT INTO project_contributors
  (project_id, member_id, role_on_project, display_order)
VALUES
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', 'Maintainer', 0);

-- project_attachments ---------------------------------------------------------
INSERT INTO project_attachments (id, project_id, kind, url, label, position)
VALUES
  ('00000000-0000-0000-0000-00000000a002',
   '00000000-0000-0000-0000-00000000a001',
   'external_link', 'https://cloudcampus.example', 'Live site', 0);

-- events ----------------------------------------------------------------------
INSERT INTO events
  (id, title, slug, description, body_markdown, location, starts_at, ends_at,
   status, visibility, created_by, approved_at)
VALUES
  ('00000000-0000-0000-0000-00000000b001',
   'CloudCampus Kickoff', 'cloudcampus-kickoff',
   'The first general assembly of the academic year.',
   'Join us for the opening assembly of CloudCampus.',
   'Innovation Hub, Tech Building',
   TIMESTAMPTZ '2026-08-15 14:00:00+00', TIMESTAMPTZ '2026-08-15 16:00:00+00',
   'approved', 'public',
   '00000000-0000-0000-0000-0000000000b1', now());

-- form_links ------------------------------------------------------------------
INSERT INTO form_links
  (id, title, description, provider_id, url, embed_url, visibility,
   is_active, display_order, created_by)
VALUES
  ('00000000-0000-0000-0000-00000000c001',
   'Membership Application', 'Apply to join CloudCampus for this academic year.',
   (SELECT id FROM form_providers WHERE name = 'Google'),
   'https://forms.google.com/cloudcampus-membership',
   'https://forms.google.com/cloudcampus-membership?embedded=true',
   'public', TRUE, 0,
   '00000000-0000-0000-0000-0000000000b1');

-- audit_log -------------------------------------------------------------------
INSERT INTO audit_log
  (id, actor_id, action, entity, entity_id, after_data)
VALUES
  ('00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1',
   'SEED_BOOTSTRAP', 'users', '00000000-0000-0000-0000-0000000000a1',
   '{"note": "Initial database seed — bootstrap admin created."}'::jsonb);
