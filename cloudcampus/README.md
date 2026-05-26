# CloudCampus

An AWS-hosted website for a campus technology student organization — a public
presence for visitors and a members' area for officers and administrators.
Built for the AWS_IS_001 capstone; the requirements baseline is
[`Docs/SRS_Student_Org_Website.md`](../Docs/SRS_Student_Org_Website.md) and
[`Docs/AWS_Feasibility_Framework.md`](../Docs/AWS_Feasibility_Framework.md).

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui components |
| Database | PostgreSQL 16 (Amazon RDS in production, Docker locally) |
| File storage | Amazon S3 — pre-signed URLs, no public bucket access |
| Auth | JWT session cookie (`jose`, HS256), `bcryptjs` password hashing |
| Hosting | AWS Amplify Hosting |

## Roles & features

The app has four roles — **guest**, **member**, **officer**, **admin** —
gated optimistically by `proxy.ts` and enforced per-page/route.

- **Public** — organization profile, officers, members directory, events,
  blog, projects, downloadable resources, and embedded Google/Microsoft forms.
- **Members** — profile editing (with photo upload), submitting blog posts and
  projects for review, private (members-only) content.
- **Officers** — creating events and voting in the event-approval queue
  (an event publishes once all three approver positions approve).
- **Admins** — a full admin area: dashboard, members, officer assignment,
  blog/project approval, events, resources, forms, roles, audit log,
  editable site content, and a categories (lookup-table) manager.

## Project layout

```
cloudcampus/
  app/
    (public)/        public + member/officer pages
    (admin)/         /admin area
    api/             route handlers (auth, uploads, admin actions, media)
  components/
    ui/              shadcn/ui primitives
    cloudcampus/     app-specific components
  lib/               db, queries, auth, jwt, s3, types, org, lookups
  db/
    migrations/      ordered SQL migrations (0001 — consolidated schema)
  scripts/           db-migrate / db-check / IAM diagnostics / SMTP check
  proxy.ts           optimistic auth gate (Next.js "Proxy")
```

## Getting started (local)

Prerequisites: Node.js 20+, Docker (for local PostgreSQL + MinIO).

```bash
cp .env.example .env       # then adjust values as needed
docker compose up -d       # local PostgreSQL + MinIO
npm install
npm run db:migrate         # apply the schema migrations
npm run dev                # http://localhost:3000
```

Create the first admin with `node scripts/_create-admin.mjs <email> <password>`
(the script ensures both the `users` and `members` rows). The migrations seed
the lookup tables (courses, year levels, etc.) and the `site_settings` row;
they do not create any admin or placeholder member.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:check` | Read-only check that the schema matches the code |
| `npm run db:iam-check` | Verify the RDS IAM-auth path end-to-end |
| `npm run s3:iam-check` | Verify the S3 IAM-credentialed path end-to-end |
| `npm run s3:upload-check` | Verify the direct-to-S3 upload + presigned-URL flow |
| `npm run smtp:check` | Verify the SMTP credentials and send a self-ping |

> Don't run `npm run build` against a folder a `npm run dev` session is using
> — they share `.next/` and mixing the artifacts causes chunk-load errors.
> Stop one, or clear `.next/`, before switching.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `true` against RDS, unset/`false` locally |
| `DATABASE_IAM_AUTH` | `true` in production to mint an RDS IAM auth token per connection (no DB password in env) |
| `DATABASE_REGION` | AWS region of the RDS instance — only when `DATABASE_IAM_AUTH=true` and `AWS_REGION` is not set |
| `JWT_SECRET` | Long random string signing session cookies |
| `S3_BUCKET`, `S3_REGION` | Target S3 bucket and region |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Local-only S3 credentials (MinIO / developer IAM user). Omit in Amplify — the attached IAM role provides credentials. |
| `smtp_email`, `smtp_pass` | Gmail SMTP user + App Password for outbound mail (password reset, registration decisions, email-change confirmations). Falls back to stdout when unset. |

Secrets live only in `.env` (gitignored). See `db/README.md` for database
detail and [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for the AWS deployment.

## Database

Schema lives in `db/migrations/` as ordered, immutable files:

- `0001_initial_schema.sql` — V1 baseline: every table (base tables, lookup
  tables, `site_settings`), type, index, trigger, and seeded reference data.
- `0002_v2_school_year_and_features.sql` — V2: school years, registration
  queue, password-reset tokens, announcements (with dismissals).
- `0003_v2_1_editing_and_approval.sql` — V2.1: multi-incumbent officer
  positions, 2/3-majority event approval with `revision_requested`,
  edit→re-approval flow, unique student-id index, date-only announcement
  columns, `site_settings.term` dropped, `projects.published_url` added.
- `0004_email_change_and_smtp.sql` — V2.1 §4: `email_change_requests` table
  for the email-change-with-verification flow.

Future schema changes add `0005_*.sql`, … `db-migrate.mjs` records applied
files in `schema_migrations`, so re-runs are safe. `npm run db:check` verifies
the live schema still matches the code.

## Documentation

- [`CHANGELOG.md`](./CHANGELOG.md) — record of changes.
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — AWS deployment & hardening.
- [`../Docs/Implementation_Notes.md`](../Docs/Implementation_Notes.md) — how the
  build extends the SRS / Feasibility / Wireframe specs.
- [`../Docs/V2_Implementation_Plan.md`](../Docs/V2_Implementation_Plan.md) and
  [`../Docs/V2.1_Implementation_Plan.md`](../Docs/V2.1_Implementation_Plan.md) —
  feature-by-feature plans driving the V2 / V2.1 sprints.
- [`../Docs/Implementation_Status.md`](../Docs/Implementation_Status.md) — which
  V2 / V2.1 items are landed vs deferred.
