# Database

PostgreSQL 16 schema for CloudCampus. Mirrors the data model in
`Docs/AWS_Feasibility_Framework.md` §6.3 and `Docs/SRS_Student_Org_Website.md` §3.5.

## Layout

- `migrations/` — ordered, immutable SQL migrations:
  - `0001_initial_schema.sql` — V1 baseline. Every base table, lookup table,
    `site_settings`, type, index, trigger, and reference data (year levels,
    member statuses, form providers, project categories, organization
    profile, officer positions).
  - `0002_v2_school_year_and_features.sql` — V2 additions: school years,
    registration queue, password-reset tokens, announcements + dismissals.
  - `0003_v2_1_editing_and_approval.sql` — V2.1: multi-incumbent officer
    positions, 2/3-majority event approval with `revision_requested`,
    `edited_at` / `previous_published_at` on blogs / projects / events,
    unique student-id index on registrations, date-only announcement
    columns, dropped `site_settings.term`, added `projects.published_url`.
  - `0004_email_change_and_smtp.sql` — V2.1 §4: `email_change_requests`
    table for the email-change-with-verification flow.
  - `0005_project_voting.sql` — `project_approvals` table + validate/finalize
    triggers, mirroring event voting for projects.
  - `0006_blog_archive.sql` — adds `'archived'` to the `blog_status` enum so
    the admin blogs queue can mirror the projects lifecycle.
  - `0007_unanimous_approvals.sql` — replaces the 2/3-majority finalizers for
    events + projects with unanimous approval; any single reject vote rejects
    the item immediately.

There is no placeholder seed. The lookup-table reference data lives inside
the migrations themselves so a fresh DB is usable immediately; create the
first admin with `node scripts/_create-admin.mjs <email> <password>`.

## Local setup

```bash
cp .env.example .env          # adjust if needed
docker compose up -d          # starts PostgreSQL + MinIO
npm run db:migrate            # applies all pending migrations
node scripts/_create-admin.mjs admin@example.org change-me     # creates the first admin
```

## How it works

- `scripts/db-migrate.mjs` records applied files in a `schema_migrations`
  table and runs each new migration in its own transaction. It connects with
  the credentials in `DATABASE_URL` (run as the master user so DDL is allowed).
- `npm run db:check` runs the read-only assertions in `scripts/db-check.mjs`
  to confirm the live schema still matches what the application code expects.

## Schema-enforced rules

The schema enforces several SRS rules directly in the database:

- **DR-04** — `events.ends_at > starts_at` (CHECK constraint).
- **DR-05** — one vote per position per event (`UNIQUE (event_id, position_id)`).
- **DR-07** — `audit_log` is append-only (UPDATE/DELETE rejected by trigger).
- **FR-OFF-05/06/07** — event-approval votes are validated (approver position,
  current officer, no self-vote, rejection / revision-request comment required)
  and the event status advances to `approved` / `rejected` automatically:
  approval requires every approver-position officer to vote `approved`, and any
  single `rejected` vote rejects the event immediately (V2.2). The same rule
  applies to project approvals.
- **V2.1** — `officer_positions.max_incumbents` caps how many current officers
  can hold each position per school year; enforced by trigger as well as the
  pre-check in `assignOfficer`.

## Production

Production uses Amazon RDS for PostgreSQL. Set `DATABASE_URL` to the RDS
endpoint with the `cloudcampus_app` user + password and `DATABASE_SSL=true`.
Run migrations as the master user by overriding `DATABASE_URL` on the command
line (the app user has DML grants only, not DDL):

```
DATABASE_URL=postgresql://cloudcampus:<master-password>@<rds-endpoint>:5432/cloudcampus \
DATABASE_SSL=true npm run db:migrate
```
