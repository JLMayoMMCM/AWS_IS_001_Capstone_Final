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
    seed.sql         placeholder data + bootstrap admin
  scripts/           db-migrate / db-seed / db-check
  proxy.ts           optimistic auth gate (Next.js "Proxy")
```

## Getting started (local)

Prerequisites: Node.js 20+, Docker (for local PostgreSQL + MinIO).

```bash
cp .env.example .env       # then adjust values as needed
docker compose up -d       # local PostgreSQL + MinIO
npm install
npm run db:migrate         # apply the schema migration
npm run db:seed            # placeholder data + bootstrap admin
npm run dev                # http://localhost:3000
```

The seeded bootstrap admin is `admin@cloudcampus.example` (password from
`SEED_ADMIN_PASSWORD`, default `CloudCampus!2026`) — change it after first
sign-in.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Insert placeholder data + bootstrap admin |
| `npm run db:reset` | `db:migrate` then `db:seed` |
| `npm run db:check` | Read-only check that the schema matches the code |

> Don't run `npm run build` against a folder a `npm run dev` session is using
> — they share `.next/` and mixing the artifacts causes chunk-load errors.
> Stop one, or clear `.next/`, before switching.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `true` against RDS, unset/`false` locally |
| `JWT_SECRET` | Long random string signing session cookies |
| `S3_BUCKET`, `S3_REGION` | Target S3 bucket and region |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3 credentials |
| `SEED_ADMIN_PASSWORD` | Bootstrap admin password used by `db:seed` |

Secrets live only in `.env` (gitignored). See `db/README.md` for database
detail and [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for the AWS deployment.

## Database

Schema lives in `db/migrations/` as ordered, immutable files. It is currently
one consolidated migration:

- `0001_initial_schema.sql` — every table (base tables, the lookup tables, and
  `site_settings`), type, index, trigger, and required reference data.

Future schema changes add `0002_*.sql`, … `db-migrate.mjs` records applied
files in `schema_migrations`, so re-runs are safe. `npm run db:check` verifies
the live schema still matches the code.

## Documentation

- [`CHANGELOG.md`](./CHANGELOG.md) — record of changes.
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — AWS deployment & hardening.
- [`../Docs/Implementation_Notes.md`](../Docs/Implementation_Notes.md) — how the
  build extends the SRS / Feasibility / Wireframe specs.
