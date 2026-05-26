# Deployment — CloudCampus on AWS

The CloudCampus stack is three AWS services (FEAS §3): **Amplify Hosting** for
the Next.js app, **RDS PostgreSQL** for data, and **S3** for binary files.

## Provisioned so far

| Resource | Name | Notes |
|----------|------|-------|
| RDS PostgreSQL | `cloudcampus-aws-rds` | PostgreSQL 16, db.t4g.micro, ap-southeast-1. IAM database authentication enabled. Schema migration applied; seeded. |
| RDS security group | `cloudcampus-aws-rds-sg` | Inbound 5432 — currently scoped to a developer IP. |
| S3 bucket | `cloudcampus-aws-s3` | Block Public Access on, versioned, SSE-S3 encrypted. |
| IAM role | `cloudcampus-aws-amplify-role` | Compute role attached to Amplify. Grants `s3:{Get,Put,Delete,List}Object/Bucket` on the bucket and `rds-db:connect` on the `cloudcampus_app` DB user. |

The application code is wired to all three: PostgreSQL via `lib/db.ts`
(IAM-authenticated when `DATABASE_IAM_AUTH=true`), S3 via `lib/s3.ts`
(pre-signed URLs; credentials come from the default AWS provider chain),
sessions via signed JWT cookies.

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

3. **Attach an IAM service role to the Amplify app.** This role provides the
   runtime credentials for S3 and RDS — no static access keys live in the
   Amplify environment. Create a role (trust principal: `amplify.amazonaws.com`)
   with two scoped policies:

   - **S3** — `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on
     `arn:aws:s3:::cloudcampus-aws-s3/*`, and `s3:ListBucket` on
     `arn:aws:s3:::cloudcampus-aws-s3`.
   - **RDS IAM auth** — `rds-db:connect` on
     `arn:aws:rds-db:ap-southeast-1:<account>:dbuser:<db-resource-id>/cloudcampus_app`.

   Attach the role under Amplify → App settings → IAM roles → *Compute role*.

4. **Set environment variables** (Amplify → App settings → Environment
   variables). No credentials — only configuration:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://cloudcampus_app@<rds-endpoint>:5432/cloudcampus` (no password — IAM auth provides it) |
   | `DATABASE_SSL` | `true` |
   | `DATABASE_IAM_AUTH` | `true` |
   | `DATABASE_REGION` | `ap-southeast-1` |
   | `JWT_SECRET` | a long random string (do not reuse the dev one) |
   | `S3_BUCKET` | `cloudcampus-aws-s3` |
   | `S3_REGION` | `ap-southeast-1` |

5. **Deploy.** Amplify builds and deploys; subsequent pushes to `main`
   redeploy automatically.

## Database migrations

Schema changes ship as ordered files in `cloudcampus/db/migrations/`. The
schema is currently a single consolidated migration, `0001_initial_schema.sql`.

The migration / seed / check scripts use the same `DATABASE_IAM_AUTH=true`
path as the app, so the developer who runs them needs `rds-db:connect` on the
target DB user (typically a separate `cloudcampus_migrator` user with DDL
privileges). With that and `aws sso login` (or any standard AWS credentials
on the shell), run from `cloudcampus/`:

```
DATABASE_URL=postgresql://cloudcampus_migrator@<rds-endpoint>:5432/cloudcampus \
DATABASE_SSL=true DATABASE_IAM_AUTH=true DATABASE_REGION=ap-southeast-1 \
npm run db:migrate
```

Then confirm the schema matches the code with `npm run db:check`. The schema
is already applied to `cloudcampus-aws-rds`.

## RDS IAM authentication — one-time setup

This must be done once on the RDS instance so the app can connect without a
password:

1. **Enable IAM auth on the instance.**
   `aws rds modify-db-instance --db-instance-identifier cloudcampus-aws-rds --enable-iam-database-authentication --apply-immediately`
2. **Create the app DB user and grant `rds_iam`.** Connected as the master
   user, run:
   ```sql
   CREATE USER cloudcampus_app;
   GRANT rds_iam TO cloudcampus_app;
   GRANT CONNECT ON DATABASE cloudcampus TO cloudcampus_app;
   GRANT USAGE ON SCHEMA public TO cloudcampus_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cloudcampus_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloudcampus_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cloudcampus_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO cloudcampus_app;
   ```
3. **Grant `rds-db:connect` on the IAM role** (see step 3 of the Amplify
   section) so it can mint auth tokens for `cloudcampus_app`.

## Post-deployment hardening

Do these once the app is live on Amplify (FEAS §3.5):

- **Lock down RDS.** Replace the developer-IP rule on `cloudcampus-aws-rds-sg`
  with one that allows 5432 only from Amplify's compute, and set the instance
  to **not** publicly accessible.
- **Enforce SSL on RDS.** Apply a parameter group with `rds.force_ssl = 1`
  (also required for IAM auth).
- **Custom domain & HTTPS.** Amplify provisions HTTPS automatically; attach a
  custom domain via Amplify → Domain management if desired.

## Local development

See `cloudcampus/db/README.md`. In short: `docker compose up -d`, then
`npm run db:migrate && npm run db:seed`, then `npm run dev`.
