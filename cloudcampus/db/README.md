# Database

PostgreSQL 16 schema for CloudCampus. Mirrors the data model in
`Docs/AWS_Feasibility_Framework.md` §6.3 and `Docs/SRS_Student_Org_Website.md` §3.5.

## Layout

- `migrations/` — ordered, immutable SQL migrations. `0001_initial_schema.sql`
  is the complete consolidated schema: every base table, lookup table,
  `site_settings`, type, index, trigger, and the required reference data
  (year levels, member statuses, form providers, project categories, the
  organization profile). Future schema changes add `0002_*.sql`, … (NFR-MNT-02).
- `seed.sql` — one placeholder row per table plus the bootstrap admin.

## Local setup

```bash
cp .env.example .env          # adjust if needed
docker compose up -d          # starts PostgreSQL + MinIO
npm run db:migrate            # applies all pending migrations
npm run db:seed               # inserts placeholder data + bootstrap admin
```

`npm run db:reset` runs migrate then seed in one step.

After seeding, the bootstrap admin is `admin@cloudcampus.example` with the
password from `SEED_ADMIN_PASSWORD` (default `CloudCampus!2026`). Change it
after first login — login is wired up in Phase 4.

## How it works

- `scripts/db-migrate.mjs` records applied files in a `schema_migrations`
  table and runs each new migration in its own transaction.
- `scripts/db-seed.mjs` skips a database that already has rows, then runs
  `seed.sql` in a transaction and sets the admin's real bcrypt password hash.

## Schema-enforced rules

The schema enforces several SRS rules directly in the database:

- **DR-04** — `events.ends_at > starts_at` (CHECK constraint).
- **DR-05** — one vote per position per event (`UNIQUE (event_id, position_id)`).
- **DR-06** — exactly 3 approver positions (deferred constraint trigger).
- **DR-07** — `audit_log` is append-only (UPDATE/DELETE rejected by trigger).
- **FR-OFF-05/06/07** — event-approval votes are validated (approver position,
  current officer, no self-vote, rejection comment required) and the event
  status advances to `approved`/`rejected` automatically.

Because of DR-06, `officer_positions` is seeded with 3 rows. `event_approvals`
is seeded empty: a valid vote needs an officer who is not the event creator,
which the single-member seed cannot provide.

## Production

Production uses Amazon RDS for PostgreSQL (provisioned in Phase 7). Set
`DATABASE_URL` to the RDS endpoint and `DATABASE_SSL=true`, then run the same
`db:migrate` / `db:seed` commands.
