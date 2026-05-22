# Deployment — CloudCampus on AWS

The CloudCampus stack is three AWS services (FEAS §3): **Amplify Hosting** for
the Next.js app, **RDS PostgreSQL** for data, and **S3** for binary files.

## Provisioned so far

| Resource | Name | Notes |
|----------|------|-------|
| RDS PostgreSQL | `cloudcampus-aws-rds` | PostgreSQL 16, db.t4g.micro, ap-southeast-1. Schema migration applied; seeded. |
| RDS security group | `cloudcampus-aws-rds-sg` | Inbound 5432 — currently scoped to a developer IP. |
| S3 bucket | `cloudcampus-aws-s3` | Block Public Access on, versioned, SSE-S3 encrypted. |
| IAM user | `cloudcampus-aws-iam` | Policy `cloudcampus-aws-iam-policy` — S3 access scoped to the bucket. |

The application code is wired to all three: PostgreSQL via `lib/db.ts`, S3 via
`lib/s3.ts` (pre-signed URLs), sessions via signed JWT cookies.

## Hosting the app on Amplify

Amplify connects to a Git repository and builds on every push. The build spec
is `amplify.yml` at the repo root (declares `appRoot: cloudcampus`).

1. **Push the code to GitHub.** The repo is
   `github.com/JLMayoMMCM/AWS_IS_001_Capstone_Final`. Commit and push the
   `main` branch so Amplify has the full application to build.

2. **Create the Amplify app.** In the AWS console → Amplify → *Create app* →
   *Host web app* → connect GitHub (authorize the Amplify GitHub app) → pick the
   repository and the `main` branch. Amplify detects `amplify.yml` and the
   `cloudcampus` app root automatically.

3. **Set environment variables** (Amplify → App settings → Environment
   variables). Copy from `cloudcampus/.env`, but use **production** values:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | the RDS connection string |
   | `DATABASE_SSL` | `true` |
   | `JWT_SECRET` | a long random string (do not reuse the dev one) |
   | `S3_BUCKET` | `cloudcampus-aws-s3` |
   | `S3_REGION` | `ap-southeast-1` |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | the `cloudcampus-aws-iam` keys |

4. **Deploy.** Amplify builds and deploys; subsequent pushes to `main`
   redeploy automatically.

## Database migrations

Schema changes ship as ordered files in `cloudcampus/db/migrations/`. The
schema is currently a single consolidated migration, `0001_initial_schema.sql`.
Apply any pending migrations against RDS with `npm run db:migrate` (from
`cloudcampus/`, with the production `DATABASE_URL` in the environment), then
confirm the schema matches the code with `npm run db:check`. The schema is
already applied to `cloudcampus-aws-rds`.

## Post-deployment hardening

Do these once the app is live on Amplify (FEAS §3.5):

- **Lock down RDS.** Replace the developer-IP rule on `cloudcampus-aws-rds-sg`
  with one that allows 5432 only from Amplify's compute, and set the instance
  to **not** publicly accessible. (It is public now so migrations could be run
  from a developer machine.)
- **Prefer an IAM role over keys.** Swap the `cloudcampus-aws-iam` access keys
  for an IAM role attached to the Amplify compute, and delete the keys.
- **Enforce SSL on RDS.** Apply a parameter group with `rds.force_ssl = 1`.
- **Custom domain & HTTPS.** Amplify provisions HTTPS automatically; attach a
  custom domain via Amplify → Domain management if desired.

## Local development

See `cloudcampus/db/README.md`. In short: `docker compose up -d`, then
`npm run db:migrate && npm run db:seed`, then `npm run dev`.
