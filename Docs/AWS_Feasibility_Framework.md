# AWS Feasibility Framework

**Project:** Student Organization Website
**Version:** 3
**Stack:** Next.js (Amplify) + PostgreSQL (RDS) + S3
**Subtitle:** Architecture · Cost Analysis · Database Design · Access Rules

---

## 1. Executive Summary

This document evaluates the feasibility of hosting a student organization / club website on AWS using a minimal three-service stack: AWS Amplify Hosting (Next.js frontend & API routes), Amazon RDS for PostgreSQL (relational data), and Amazon S3 (file storage). The goal is a budget-friendly, easy-to-setup, low-maintenance platform that supports public visitors, logged-in members, officers, and administrators.

Feasibility is high. The selected stack consolidates compute, storage, and database into AWS-managed services, eliminating the need for separate auth, CDN, or serverless function services. With Free Tier credits and conservative sizing, monthly cost can stay between $0 and ~$30 for the first year, and remain under ~$50/month thereafter for a typical student-org workload.

### 1.1 Feasibility Scorecard

| Dimension | Rating | Justification |
|-----------|--------|---------------|
| Technical | High | Mature managed services; Next.js + Amplify is a documented happy-path. |
| Financial | High | Free Tier covers most of year 1; ongoing cost ~$25–$50/month. |
| Operational | High | Amplify auto-deploys from Git; RDS handles backups/patching. |
| Scalability | High | Scales from <100 members to several thousand without re-architecture. |
| Maintainability | Med | Single Next.js codebase; minimal infra surface area. |
| Security | High | IAM, VPC isolation for RDS, S3 pre-signed URLs, HTTPS by default. |

### 1.2 Design Principles Applied

- Minimum services: 3 (Amplify, RDS, S3) — no separate Cognito, CloudFront, Lambda, or API Gateway.
- One correct path per concern: one auth flow, one upload flow, one deploy flow.
- Fail fast: schema constraints + Next.js API route guards enforce preconditions.
- Single responsibility: Amplify = app, RDS = data, S3 = files. No overlap.

---

## 2. Feasibility Framework

The framework evaluates the project across six dimensions. Each dimension lists the question it answers, the criteria used, and the verdict for this project.

| Dimension | Key Question | Evaluation Criteria | Verdict |
|-----------|--------------|---------------------|---------|
| Technical | Can it be built with the chosen stack? | Stack maturity, integration points, learning curve | Feasible — well-trodden stack |
| Financial | Can it run within a student-org budget? | Monthly cost vs. ~$20–$50/month target; Free Tier coverage | Feasible — Free Tier year 1 |
| Operational | Can a small team maintain it? | Deploy effort, patching burden, on-call expectations | Feasible — managed services |
| Scalability | Will it handle peak events (recruitment week)? | Concurrent users, file downloads, DB connections | Feasible — vertical scaling room |
| Security | Is member data adequately protected? | Auth strength, network isolation, secret storage | Feasible — RDS in private subnet, IAM, HTTPS |
| Maintainability | Is handover to next year's officers realistic? | Codebase size, doc quality, infra-as-code | Feasible — single repo, README + this doc |

### 2.1 Risks & Mitigations

| Risk | Likelihood / Impact | Mitigation |
|------|---------------------|------------|
| Free Tier expiry surprise | High / Medium | Set AWS Budgets alert at $20 and $40; document end-of-Free-Tier date in repo README. |
| RDS idle cost when club inactive | Medium / Medium | Use db.t4g.micro; optionally stop RDS during summer break (auto-restarts after 7 days, plan accordingly). |
| S3 public-bucket misconfiguration | Medium / High | Block Public Access ON; serve files via pre-signed URLs only. |
| Officer turnover / knowledge loss | High / High | Single source of truth: this document + repo README; admin role transfer documented in runbook. |
| Secrets leaked in Git | Medium / High | Store DB password + S3 keys in Amplify environment variables, never in code. |

---

## 3. AWS Architecture

The architecture intentionally uses only three AWS services. All compute and request handling live inside Next.js running on Amplify Hosting; the database lives in a private subnet on RDS; user-uploaded files live in a private S3 bucket served via pre-signed URLs.

### 3.1 Service Roles

| Service | Role | What it handles |
|---------|------|-----------------|
| AWS Amplify Hosting | Application tier | Next.js build & deploy from GitHub, SSR pages, API routes (auth, CRUD, S3 pre-signed URL generation), HTTPS, CDN, custom domain. |
| Amazon RDS (PostgreSQL) | Data tier | All relational data: users, officers, members, blogs, resources metadata, form links, audit trail. Automated backups. |
| Amazon S3 | Storage tier | Binary files: PDFs, images for blogs, downloadable resources, member profile photos. Access via pre-signed URLs. |

### 3.2 Request Flow

1. Visitor or member hits the site via HTTPS — Amplify serves the Next.js app.
2. Login submits credentials to a Next.js API route; the route queries RDS to verify the bcrypt-hashed password and issues a session cookie (JWT, HttpOnly).
3. Authenticated pages call internal Next.js API routes; routes check session role (guest / member / officer / admin) and query RDS via a connection pool.
4. File downloads: the API route generates a short-lived pre-signed S3 URL and returns it. The browser fetches the file directly from S3.
5. File uploads (admin only): the API route generates a pre-signed PUT URL; the browser uploads directly to S3; the API route then writes the metadata row to RDS.

### 3.3 Why this minimal stack works

- Next.js API routes replace AWS Lambda + API Gateway for the small-to-medium workload of a student org.
- Amplify's built-in CDN replaces a separate CloudFront distribution.
- A self-managed auth table in PostgreSQL + JWT cookies replaces Cognito — simpler, no extra service, fine for a single tenant.
- S3 pre-signed URLs replace a custom file-serving endpoint — no bandwidth flows through Amplify, lowering cost.

### 3.4 Architecture Diagram (text)

```
                       [ Internet / Users ]
                              |  HTTPS
                              v
                 +-------------------------+
                 |   AWS Amplify Hosting   |   <-- GitHub
                 |   Next.js app + API     |
                 +-----------+-------------+
                             |
              +--------------+---------------+
              |                              |
              v                              v
  +-----------------------+      +-----------------------+
  |  RDS PostgreSQL       |      |  Amazon S3 (private)  |
  |  (private subnet)     |      |  pre-signed URL access|
  |  db.t4g.micro         |      |  versioned bucket     |
  +-----------------------+      +-----------------------+
```

### 3.5 Network & Security Configuration

| Concern | Configuration |
|---------|---------------|
| VPC | Default VPC is sufficient. RDS placed in private subnets only. |
| RDS access | Security group allows inbound 5432 only from Amplify's egress IP ranges (or VPC-connected Amplify compute). |
| S3 bucket | Block Public Access ON. Bucket policy denies all public reads. Access only via pre-signed URLs signed by IAM role used by Amplify. |
| IAM | One IAM role for Amplify with: S3 GetObject/PutObject/DeleteObject scoped to the bucket; no other permissions. |
| Secrets | DB connection string, JWT secret, S3 bucket name in Amplify environment variables. |
| TLS | Amplify provides HTTPS automatically. RDS requires SSL connections (rds.force_ssl = 1). |
| Backups | RDS automated backups: 7-day retention. S3 versioning enabled on the bucket. |

---

## 4. Cost Analysis (Budget-Friendly)

Costs are estimated in USD for the us-east-1 region and rounded for planning. Actual prices may shift; always verify in the AWS Pricing Calculator before launch.

### 4.1 Year 1 (Free Tier active)

| Service | Usage assumption | Free Tier | Monthly cost (Y1) |
|---------|------------------|-----------|-------------------|
| Amplify Hosting | Small Next.js app, <5 GB served/mo, <1000 build min/mo | Yes — 1000 build min, 15 GB served | $0 |
| RDS PostgreSQL | db.t4g.micro, 20 GB gp3, single-AZ | Yes — 750 hrs/mo, 20 GB | $0 |
| S3 | 10 GB stored, 50 GB transfer out | Yes — 5 GB stored, 15 GB out | ~$1–$3 |
| Data transfer | Light | 100 GB/mo free aggregate | $0 |
| Domain (Route 53 optional) | 1 domain | No | ~$1 (~$12/yr) |
| **TOTAL (Y1)** |  |  | **~$0–$5 / month** |

### 4.2 Year 2+ (Free Tier expired)

| Service | Usage assumption | Notes | Monthly cost |
|---------|------------------|-------|--------------|
| Amplify Hosting | Same as Y1 | $0.01/build min, $0.15/GB served | ~$2–$8 |
| RDS PostgreSQL | db.t4g.micro, 20 GB gp3, single-AZ | ~$0.016/hr + storage | ~$15–$18 |
| S3 | 20 GB stored, 100 GB transfer out | $0.023/GB stored, $0.09/GB out | ~$10–$12 |
| Backups | RDS automated, 20 GB | Free up to DB size | $0 |
| Domain | Route 53 hosted zone + .com | $0.50/mo + ~$1/mo | ~$1.50 |
| **TOTAL (Y2+)** |  |  | **~$28–$40 / month** |

### 4.3 Cost-Saving Tactics

- Use Graviton (t4g) RDS instance class — cheapest tier with adequate performance.
- Stay single-AZ for RDS — multi-AZ doubles DB cost and isn't needed for a student org.
- Set a CloudWatch billing alert at $20 and a hard cap alert at $50.
- Compress images before upload (Next.js Image component handles this automatically).
- If the club is dormant in summer, stop the RDS instance — saves ~$15/month (auto-restarts after 7 days, document this).
- Apply for AWS Educate credits — eligible student organizations can receive promotional credits.

---

## 5. Website Structure & Flow

The site has two clear surfaces: a public surface for visitors and members, and an admin surface gated by role. Both share the same Next.js app and are protected at the API-route layer.

### 5.1 Site Map

```
Public                              Admin (role = admin)
------                              --------------------
/                  (welcome)        /admin             (dashboard)
/login                              /admin/content
/officers                           /admin/officers
/members          (list)            /admin/members
/members/[id]     (detail)          /admin/blogs/approval
/forms                              /admin/resources
/blogs                              /admin/projects
/blogs/[slug]                       /admin/events
/resources                          /admin/roles
/resources/[id]                     /admin/audit
/projects         (list)
/projects/[id]    (detail)         Officer-only
/events           (list)           ------------
/events/[slug]    (detail)         /events/new      (submit)
/profile          (logged-in)      /events/approvals (vote queue)
```

### 5.2 User Journey by Role

#### Guest (not logged in)

- Land on `/` (welcome page): mission, upcoming events, officers, recent public blogs.
- Browse public officers and public blogs.
- View the members list with limited info only (name, photo, course, year) — no contact details, no bio.
- Cannot open individual member detail pages (`/members/[id]`).
- Browse the projects list and view public project detail pages (description, contributors, repo / live links).
- Browse approved public events on `/events` and view event detail pages.
- View resources marked public — preview PDFs in-browser, download via pre-signed URL.
- Open forms tab — embedded Google Forms / MS Forms iframes.
- Cannot view full member directory, private resources, private projects, private events, or any admin page.

#### Member (logged in)

- All guest abilities.
- Access the full member directory including contact details and bios.
- Open individual member detail pages (`/members/[id]`) — shows full profile, officer history, contributed projects, authored blogs.
- Access private blogs, private resources, private projects, and private events.
- Edit own profile (`/profile`): name, photo, contact info, bio.
- Submit blog posts for admin approval.
- Submit projects for admin approval (sets status = 'pending').
- Cannot create events — that is an officer-only capability.

#### Officer (member with a current officers row)

- All member abilities.
- Create new events via `/events/new` — fills in title, description, location, start/end datetime, visibility. Event is saved with status = 'pending'.
- Edit own pending events (until first approval/rejection vote is cast).
- If the officer holds one of the 3 approver positions (President / VP / Secretary): vote approve or reject on any pending event at `/events/approvals` — unless they themselves created that event.
- View own queue: 'My pending events' and 'Events awaiting my vote'.
- Cannot edit other officers' events, cannot delete events, cannot approve own events.

#### Admin (privileged member)

- All member and officer abilities (admin is implicitly considered to have officer-tier read access).
- Content editor: welcome page, officer page copy.
- Register / edit / deactivate officers and members.
- Manage officer positions: rename, reorder, set which 3 are event approvers (is_approver flag).
- Approve or reject submitted blogs.
- Approve, reject, edit, or delete projects; toggle project public/private.
- Override events: edit, cancel, delete, or force-approve any event (force-approve bypasses the 3-officer rule and is fully logged in audit_log).
- Upload and categorize resources; toggle public/private; edit metadata.
- Manage form links (paste Google Forms / MS Forms URL, set visibility).
- Grant or revoke admin role on existing members.
- View audit trail.

### 5.3 Page-by-Page Flow

| Page | Access | Behavior |
|------|--------|----------|
| `/` (welcome) | Public | SSR fetch of CMS content row + latest 3 approved public blogs + next 3 upcoming approved public events from RDS. |
| `/login` | Public | POST to `/api/auth/login` → bcrypt check → set HttpOnly JWT cookie → redirect. |
| `/officers` | Public | SSR list from officers table joined to members & officer_positions. Photos via pre-signed URLs. |
| `/members` (list) | Public | SSR list — guests see name/photo/course/year only; members see contact + bio. API filters fields by role. |
| `/members/[id]` | Member | Full profile: bio, contact, officer history, contributed projects, authored blogs. Guests get 403. |
| `/forms` | Public/Member | Lists form_links rows; renders Google/MS Forms in `<iframe>` tags. |
| `/blogs` | Public/Member | Lists approved blogs; private blogs hidden from guests. |
| `/blogs/[slug]` | Public/Member | Full blog post; images served via pre-signed URLs. |
| `/resources` | Public/Member | Filter by category; private resources hidden from guests. |
| `/resources/[id]` | Public/Member | Preview PDF in-browser (PDF.js / iframe) or download via pre-signed URL. |
| `/projects` (list) | Public/Member | Lists approved projects; private projects hidden from guests. Filter by tag, sort by date. |
| `/projects/[id]` | Public/Member | Project detail: description, contributors (linked to members), repo URL, live URL, screenshots, dates. |
| `/events` (list) | Public/Member | Lists approved events grouped by 'Upcoming' and 'Past'. Private events hidden from guests. |
| `/events/[slug]` | Public/Member | Event detail: description, location (with map link), start/end datetime, add-to-calendar button. |
| `/events/new` | Officer | Form to submit a new event. Only members who hold a current officers row can reach this page. |
| `/events/approvals` | Officer | Vote queue. Shown only to officers in one of the 3 approver positions. Lists pending events + approve/reject UI. |
| `/profile` | Member | GET/PUT to `/api/members/me`; member can edit only their own row. |
| `/admin/*` | Admin | Layout-level guard: redirect to `/login` if role != admin. Each page calls its own admin API route. |

### 5.4 Authentication & Session Flow

1. Login form posts email + password to `/api/auth/login`.
2. API route looks up `users.password_hash` by email and verifies with bcrypt.
3. On success, API issues a signed JWT (containing user_id, member_id, role, exp) as an HttpOnly Secure cookie.
4. Next.js middleware reads the cookie and attaches `{ user_id, member_id, role }` to every request.
5. Officer status is derived per-request, not baked into the JWT: routes that need it query officers WHERE member_id = session.member_id AND is_current = TRUE, optionally JOIN officer_positions ON is_approver = TRUE to determine voting rights. This means officer turnover takes effect immediately without re-issuing tokens.
6. Each protected API route checks role (and officer status when applicable) before querying RDS.
7. Logout clears the cookie.

---

## 6. PostgreSQL Database Architecture

Schema is normalized and minimal. All tables use surrogate UUID primary keys, created_at / updated_at timestamps, and explicit foreign keys with ON DELETE behavior chosen per relationship.

### 6.1 Entity Overview

| Table | Purpose |
|-------|---------|
| users | Authentication identity. One row per person who can log in. Holds email, password_hash, role. |
| members | Profile data. Linked 1:1 to users via user_id. Stores name, photo, bio, contact info, status. |
| officers | Officer roles. Linked to members; multiple officers per term; holds position, term, order. |
| officer_positions | Lookup table of officer position titles AND which 3 positions are required to approve events (is_approver flag). |
| blogs | Blog posts. Holds title, slug, body, author_id, status (draft/pending/approved/rejected), visibility (public/private). |
| resources | Resource metadata. Holds title, description, category, s3_key, visibility, icon, uploaded_by. |
| resource_categories | Lookup table for resource categories. |
| projects | Member projects. Holds title, description, repo_url, live_url, screenshot, status, visibility, dates. |
| project_contributors | Many-to-many join: which members contributed to which project, with their role on it. |
| events | Org events. Holds title, description, location, start/end datetime, status, visibility, created_by (officer). |
| event_approvals | Records each approval/rejection vote on an event by a required officer position. |
| form_links | External form integrations. Holds title, provider (google/microsoft), url, visibility, order. |
| audit_log | Append-only record of admin actions: who edited what, when, before/after. |

### 6.2 Entity-Relationship Diagram (text)

```
users (1) ───── (1) members (1) ───── (0..n) officers ─── (n..1) officer_positions
  │                  │
  │                  ├── (0..n) blogs (as author_id)
  │                  │
  │                  ├── (0..n) project_contributors ──── projects
  │                  │
  │                  └── (0..n) events (as created_by)
  │                                  │
  │                                  └── (1..n) event_approvals ── officers
  │
  └── (0..n) audit_log (as actor_id and target_id)

resource_categories (1) ──── (0..n) resources
members (1) ──── (0..n) resources (as uploaded_by)
members (1) ──── (0..n) projects (as submitted_by)
members (1) ──── (0..n) form_links (as created_by)
```

### 6.3 Schema (DDL)

#### Extensions & enums

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()

CREATE TYPE user_role     AS ENUM ('guest','member','officer','admin');
CREATE TYPE blog_status   AS ENUM ('draft','pending','approved','rejected');
CREATE TYPE project_status AS ENUM ('draft','pending','approved','rejected','archived');
CREATE TYPE event_status  AS ENUM ('draft','pending','approved','rejected','cancelled','completed');
CREATE TYPE visibility    AS ENUM ('public','private');
CREATE TYPE form_provider AS ENUM ('google','microsoft');
CREATE TYPE member_status AS ENUM ('active','alumni','inactive');
```

#### users — login identity

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT   NOT NULL,                  -- bcrypt
  role          user_role NOT NULL DEFAULT 'member',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### members — profile / directory

```sql
CREATE TABLE members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  student_id    TEXT UNIQUE,
  course        TEXT,
  year_level    SMALLINT,
  bio           TEXT,
  photo_s3_key  TEXT,                             -- S3 object key
  contact_email TEXT,
  status        member_status NOT NULL DEFAULT 'active',
  joined_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### officer_positions — lookup of position titles & event-approver flag

```sql
CREATE TABLE officer_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,             -- e.g. 'President', 'VP', 'Secretary'
  is_approver   BOOLEAN NOT NULL DEFAULT FALSE,   -- true = required to approve events
  display_order INTEGER NOT NULL DEFAULT 0
);
-- Exactly 3 rows must have is_approver = TRUE.
CREATE UNIQUE INDEX officer_positions_three_approvers
  ON officer_positions ((TRUE)) WHERE is_approver;  -- combined with CHECK trigger

-- Seed example (President, VP, Secretary are the 3 event approvers):
INSERT INTO officer_positions (name, is_approver, display_order) VALUES
  ('President', TRUE,  1),
  ('Vice President', TRUE, 2),
  ('Secretary', TRUE, 3),
  ('Treasurer', FALSE, 4),
  ('PRO',        FALSE, 5);
```

#### officers — connected to members

```sql
CREATE TABLE officers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES officer_positions(id) ON DELETE RESTRICT,
  term_label    TEXT NOT NULL,                    -- e.g. 'AY 2025-2026'
  term_start    DATE NOT NULL,
  term_end      DATE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_current    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON officers (is_current, display_order);
```

#### blogs — posts with images & external links

```sql
CREATE TABLE blogs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  body_markdown TEXT NOT NULL,                    -- supports embedded image refs & URLs
  cover_s3_key  TEXT,
  status        blog_status NOT NULL DEFAULT 'pending',
  visibility    visibility  NOT NULL DEFAULT 'public',
  approved_by   UUID REFERENCES members(id),
  approved_at   TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON blogs (status, visibility, published_at DESC);
```

#### blog_attachments — extra images & external links per blog

```sql
CREATE TABLE blog_attachments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id   UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('image','external_link','resource_link')),
  s3_key    TEXT,                                 -- when kind='image'
  url       TEXT,                                 -- when kind='external_link'
  resource_id UUID REFERENCES resources(id),      -- when kind='resource_link'
  caption   TEXT,
  position  INTEGER NOT NULL DEFAULT 0
);
```

#### resource_categories & resources

```sql
CREATE TABLE resource_categories (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT UNIQUE NOT NULL,
  icon  TEXT
);

CREATE TABLE resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES resource_categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,                             -- icon name or emoji
  s3_key        TEXT NOT NULL,                    -- pointer to S3 object
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  visibility    visibility NOT NULL DEFAULT 'private',
  uploaded_by   UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON resources (category_id, visibility);
```

#### projects — member projects

```sql
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT NOT NULL,                    -- short summary for list view
  body_markdown TEXT,                              -- long-form details for detail page
  repo_url      TEXT,                              -- GitHub / GitLab / Bitbucket link
  live_url      TEXT,                              -- deployed site / demo link
  tech_stack    TEXT[],                            -- e.g. {'Next.js','PostgreSQL','AWS'}
  tags          TEXT[],                            -- e.g. {'mobile','ml','hackathon'}
  cover_s3_key  TEXT,                              -- main screenshot / banner
  status        project_status NOT NULL DEFAULT 'pending',
  visibility    visibility NOT NULL DEFAULT 'public',
  submitted_by  UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  approved_by   UUID REFERENCES members(id),
  approved_at   TIMESTAMPTZ,
  started_on    DATE,                              -- when work began
  completed_on  DATE,                              -- when finished (null if ongoing)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON projects (status, visibility, created_at DESC);
```

#### project_contributors — many-to-many: members ↔ projects

```sql
CREATE TABLE project_contributors (
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  role_on_project TEXT,                            -- e.g. 'Lead Developer', 'Designer'
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, member_id)
);
CREATE INDEX ON project_contributors (member_id);
```

#### project_attachments — extra screenshots & links

```sql
CREATE TABLE project_attachments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('image','external_link')),
  s3_key     TEXT,                                 -- when kind='image'
  url        TEXT,                                 -- when kind='external_link'
  label      TEXT,                                 -- e.g. 'Demo video', 'Devpost'
  position   INTEGER NOT NULL DEFAULT 0
);
```

#### events — org events requiring multi-officer approval

```sql
CREATE TABLE events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT NOT NULL,                    -- short summary for list view
  body_markdown TEXT,                              -- full details, images, links
  cover_s3_key  TEXT,
  location      TEXT,                              -- venue or 'Online'
  location_url  TEXT,                              -- map link or meet link
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  status        event_status NOT NULL DEFAULT 'pending',
  visibility    visibility   NOT NULL DEFAULT 'public',
  created_by    UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  -- created_by member MUST hold a current officer row (enforced by trigger / API)
  approved_at   TIMESTAMPTZ,                       -- set when 3rd approver approves
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX ON events (status, starts_at);
CREATE INDEX ON events (visibility, status, starts_at DESC);
```

#### event_approvals — one row per required-position vote

```sql
CREATE TABLE event_approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES officer_positions(id) ON DELETE RESTRICT,
  officer_id    UUID NOT NULL REFERENCES officers(id) ON DELETE RESTRICT,
  decision      TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  comment       TEXT,                              -- required when 'rejected'
  decided_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, position_id)                  -- one vote per required position
);
CREATE INDEX ON event_approvals (event_id);

-- Application rule (enforced in API + a Postgres trigger):
--   1. event_approvals.position_id must reference a position where is_approver=TRUE.
--   2. event_approvals.officer_id must currently hold that position (officers.is_current=TRUE).
--   3. When all 3 approver positions have rows with decision='approved',
--      set events.status='approved' and events.approved_at=NOW().
--   4. Any decision='rejected' sets events.status='rejected' immediately.
--   5. The event creator cannot vote on their own event (officer_id != events.created_by's officer row).
```

#### form_links — Google Forms & MS Forms

```sql
CREATE TABLE form_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  provider      form_provider NOT NULL,           -- 'google' | 'microsoft'
  url           TEXT NOT NULL,                    -- full shareable URL
  embed_url     TEXT,                             -- iframe-safe URL (derived)
  visibility    visibility NOT NULL DEFAULT 'public',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### audit_log — who edited who

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES users(id),     -- who performed the action
  action      TEXT NOT NULL,                          -- e.g. 'UPDATE_MEMBER'
  entity     TEXT NOT NULL,                           -- e.g. 'members'
  entity_id   UUID,                                   -- affected row id
  before_data JSONB,                                  -- previous values
  after_data  JSONB,                                  -- new values
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON audit_log (entity, entity_id, created_at DESC);
CREATE INDEX ON audit_log (actor_id, created_at DESC);
```

### 6.4 Why this design

- `users` and `members` are separated so login identity and profile data have clean responsibilities; deactivating a login doesn't lose member history.
- `officers` references `members` so officer history survives across academic years without duplicating member data.
- `officer_positions` is a small lookup table with an `is_approver` flag — this lets the org configure which 3 positions approve events (e.g. President / VP / Secretary) without code changes, and prevents data-entry typos on the position name.
- `events` + `event_approvals` splits the event itself from its approval votes. One row per required position in `event_approvals` means counting approvals is just `COUNT(*) WHERE decision='approved'`.
- The `UNIQUE (event_id, position_id)` constraint on `event_approvals` makes it physically impossible for the same position to vote twice — the database enforces the rule, not the application.
- `resources` only stores metadata; the binary lives in S3 — the single source of truth for binaries is S3, the single source of truth for metadata is RDS.
- `projects` has its own `submitted_by`/`approved_by` columns (same approval flow as blogs) plus a `project_contributors` join table — one project can credit many members, and one member's profile page can show every project they touched.
- `repo_url` and `live_url` are first-class columns (not generic links) so the project list can render the right icon per link type without parsing URLs.
- `form_links` stores both the share URL and a derived `embed_url` so the website can iframe Google Forms / MS Forms without manual URL editing every time.
- `audit_log` is append-only with JSONB before/after — one table satisfies the entire audit-trail requirement.

---

## 7. Website Rules (Access Control)

Four roles: guest (no login), member (logged-in user), officer (a member with a current officers row), and admin (member with elevated rights). Officer is determined dynamically by joining the session's member_id to the officers table where is_current = TRUE — it is NOT a column on users. Rules are enforced at the API-route layer in Next.js — the UI hides items the user can't use, but the API is the source of truth.

### 7.1 Role Capability Matrix

| Capability | Guest | Member | Officer | Admin | Enforced by |
|------------|-------|--------|---------|-------|-------------|
| View welcome page | Yes | Yes | Yes | Yes | Page (public) |
| View public officers | Yes | Yes | Yes | Yes | API filter |
| View members list — limited fields only | Yes | Yes | Yes | Yes | API field-level filter |
| View members list — full fields | No | Yes | Yes | Yes | API role check |
| View individual member detail page | No | Yes | Yes | Yes | API role check |
| View public blogs | Yes | Yes | Yes | Yes | API filter |
| View private blogs | No | Yes | Yes | Yes | API role check |
| View public resources | Yes | Yes | Yes | Yes | API filter |
| View private resources | No | Yes | Yes | Yes | API role check |
| Download/preview visible resources | Yes | Yes | Yes | Yes | Pre-signed URL |
| View public projects (list+detail) | Yes | Yes | Yes | Yes | API filter |
| View private projects | No | Yes | Yes | Yes | API role check |
| View public events (approved only) | Yes | Yes | Yes | Yes | API filter |
| View private events | No | Yes | Yes | Yes | API role check |
| Submit a form (Google/MS Forms) | Yes | Yes | Yes | Yes | External (form provider) |
| Edit OWN profile | No | Yes | Yes | Yes | API: user_id match |
| Edit ANY member's profile | No | No | No | Yes | API role check |
| Submit blog post (pending) | No | Yes | Yes | Yes | API role check |
| Submit project (pending) | No | Yes | Yes | Yes | API role check |
| Create event (pending) | No | No | Yes | Yes | API: officer check |
| Edit OWN pending event (no votes yet) | No | No | Yes | Yes | API: created_by match + status=pending |
| Vote approve/reject on a pending event | No | No | Yes* | Yes | API: officer holds approver position |
| Approve / reject blogs | No | No | No | Yes | API role check |
| Approve / reject / edit / delete projects | No | No | No | Yes | API role check |
| Force-approve, edit, cancel, or delete event | No | No | No | Yes | API role check |
| Upload resources | No | No | No | Yes | API role check |
| Edit / delete resources | No | No | No | Yes | API role check |
| Manage resource categories | No | No | No | Yes | API role check |
| Add / edit form links | No | No | No | Yes | API role check |
| Register / edit / deactivate officers | No | No | No | Yes | API role check |
| Manage officer positions (incl. approver flag) | No | No | No | Yes | API role check |
| Register / deactivate members | No | No | No | Yes | API role check |
| Grant or revoke admin role | No | No | No | Yes | API role check |
| View audit trail | No | No | No | Yes | API role check |

*\* Officer may vote on events only if they hold one of the 3 positions flagged is_approver=TRUE, and only on events they did not create.*

### 7.2 Specific Rules

#### Guest

- Can browse: welcome page, public officer list, public blogs, public resources, public projects, public events, public form links.
- Can view the members list with limited fields only (name, photo, course, year_level) — the API strips contact_email, bio, student_id, and joined_at from the response when the request has no session.
- Cannot open `/members/[id]` detail pages — these return 403 for guests.
- Cannot: see private blogs/resources/projects/events, or hit any `/admin` route.
- Any private resource, private project, or private event is invisible — not just disabled — so guests don't even see it exists.

#### Member (logged in)

- Can: do everything a guest can, plus access full member fields, individual member detail pages, private blogs, private resources, private projects, and private events.
- Can edit own profile only — API checks `members.user_id = session.user_id` before updating.
- Can submit a blog post; it is saved with `status = 'pending'` and is invisible to everyone except admins until approved.
- Can submit a project; it is saved with `status = 'pending'` and is invisible to guests and other members until approved. Submitting member is auto-added as a project_contributor.
- Cannot create events, cannot edit other members, cannot upload resources, cannot manage forms, cannot approve anything.

#### Officer (member with current officers row)

- All member abilities.
- Can create events via `/events/new`. The new event is saved with `status = 'pending'` and is invisible to guests until 3 approver votes are recorded as 'approved'.
- Can edit own pending event ONLY while no votes have been cast yet — the API checks `created_by = session.member_id AND status = 'pending' AND NOT EXISTS (event_approvals for that event)`. Once a single vote exists, the event is locked from author edits.
- If the officer holds an `is_approver` position (President / VP / Secretary or whichever 3 are configured): can cast a single approve/reject vote per event at `/events/approvals`. The API rejects the vote if officer_id matches the event creator.
- When the 3rd 'approved' vote is recorded, the API sets `events.status = 'approved'` and `events.approved_at = NOW()` in the same transaction as inserting the vote.
- Any single 'rejected' vote immediately sets `events.status = 'rejected'`. A rejection comment is required.
- Cannot delete events, cannot change approver positions, cannot bypass the vote requirement.

#### Admin

- Full read/write on all tables.
- Can register new members (creates a users row + members row in one transaction; sends initial credentials out-of-band).
- Can edit any member — every edit writes to audit_log (actor_id = admin, target = member row, before/after JSON).
- Can grant or revoke admin role on any existing member, except admins cannot revoke their own role (prevents lockout).
- Can manage officer_positions: rename, reorder, set is_approver — but the count of is_approver=TRUE rows must remain exactly 3 (enforced by a Postgres trigger; admin sees a clear error if violated).
- Can approve or reject blogs; rejected blogs return to author with status = 'rejected'.
- Can approve, reject, edit, archive, or delete any project; can edit the contributor list on any project; can toggle project visibility (public/private).
- Can edit, cancel, or delete any event regardless of approval state.
- Can force-approve an event (bypasses the 3-vote requirement). Force-approval inserts a single audit_log row with action = 'FORCE_APPROVE_EVENT' and is visible to all admins in the audit view.
- Can mark resources as public or private at upload time and at any later edit.
- Can manage resource categories: create, rename, delete (delete sets category_id = NULL on affected resources, never deletes resources implicitly).

### 7.3 Auditing Rules

- Every write to users, members, officers, officer_positions, resources, form_links, projects, events, every blog or project status change, and every event_approvals insert writes one row to audit_log.
- audit_log is append-only — no UPDATE or DELETE allowed (enforced by Postgres role privileges on the audit_log table).
- Audit log shows: who did it, what action, what entity, what changed, when, from what IP.
- Admins can filter audit_log by actor, by target member, by date range, and by action type.
- Event-specific audit entries to watch: `CREATE_EVENT`, `VOTE_APPROVE_EVENT`, `VOTE_REJECT_EVENT`, `FORCE_APPROVE_EVENT` (admin override), `CANCEL_EVENT`, `DELETE_EVENT`.

### 7.4 Hard Safety Rules

- The very first admin is created via a one-time database seed script — there is no self-service admin signup, ever.
- An admin cannot delete themselves and cannot remove their own admin role (prevents the system from having zero admins).
- Password reset is admin-initiated only — admin issues a one-time reset link to the member's email.
- Sessions expire after 7 days of inactivity; JWT is rotated on login.
- The officer_positions table must always contain exactly 3 rows with is_approver = TRUE — enforced by a Postgres trigger. The seed script sets the initial 3.
- If an approver position is vacant (no current officers row for that position), the API blocks event approvals from completing and surfaces a clear admin alert on `/admin` to assign someone to the vacant role.
- An officer voting on an event cannot also have created that event — enforced in the API and double-checked by the trigger that runs after insert on event_approvals.

---

## 8. Setup Checklist

End-to-end setup follows roughly this order. Each step is a checkbox for the officer team.

### 8.1 AWS account preparation

1. Create or sign in to an AWS account (use a shared org email).
2. Enable MFA on the root account.
3. Create an IAM user 'club-admin' with AdministratorAccess for setup, plus MFA.
4. Set a billing alert: AWS Budgets → $20 warning, $50 hard alert.

### 8.2 S3 setup

1. Create bucket: `<club>-website-files` (region us-east-1).
2. Block Public Access: ON for all four settings.
3. Enable versioning.
4. Enable default encryption (SSE-S3).
5. Create folder structure: `/members`, `/blogs`, `/resources`, `/officers`.
6. Create IAM policy granting GetObject/PutObject/DeleteObject only on this bucket.

### 8.3 RDS setup

1. Create RDS PostgreSQL instance: engine PostgreSQL 16, instance db.t4g.micro, 20 GB gp3.
2. Single-AZ; automated backups 7 days.
3. Place in private subnets; security group allows 5432 only from Amplify.
4. Set `rds.force_ssl = 1` in the parameter group.
5. Save master password to a password manager — never to Git.
6. Connect once via a temporary EC2 / Cloud9 / local psql and run the DDL from Section 6.
7. Run the seed script to insert the very first admin user.

### 8.4 Amplify Hosting setup

1. Push the Next.js project to GitHub.
2. In Amplify Console: 'Host web app' → connect the GitHub repo and main branch.
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `S3_BUCKET`, `AWS_REGION`, plus IAM access key/secret bound to the S3 policy.
4. Verify the first deploy succeeds.
5. (Optional) Connect a custom domain via Route 53.

### 8.5 Operational hygiene

1. Document the admin handover process in repo README (rotate JWT_SECRET, rotate DB password, transfer Amplify owner).
2. Schedule one calendar event per semester to verify backups and review audit_log.
3. Add a `CONTRIBUTING.md` so next year's officers know how to run the project locally.

---

## 9. Conclusion

The proposed AWS-hosted student organization website is feasible across every dimension evaluated — technical, financial, operational, scalability, security, and maintainability. By restricting the design to three AWS services (Amplify, RDS, S3), the project avoids the complexity of larger AWS reference architectures while still satisfying all functional requirements on both the public and admin sides.

The PostgreSQL schema cleanly separates identity (users) from profile (members), uses one append-only table to satisfy the audit-trail requirement, and stores binaries in S3 with metadata in RDS — one source of truth per concern. The access-control model is enforced at the API-route layer and is summarized in a single role-capability matrix.

Estimated cost is $0–$5/month during the AWS Free Tier (year 1) and $28–$40/month thereafter, comfortably within a typical student organization budget. Setup follows a linear checklist and can realistically be completed by a small officer team over a single weekend.
