# Deployment — CloudCampus on AWS

The CloudCampus stack is three AWS services (FEAS §3): **Amplify Hosting** for
the Next.js app, **RDS PostgreSQL** for data, and **S3** for binary files.

Authentication is **password / access-key based**: the DB password lives in
`DATABASE_URL` and S3 uses a static IAM-user access-key pair. No IAM database
authentication and no Amplify compute role are used.

## Provisioned

| Resource | Name | Notes |
|----------|------|-------|
| RDS PostgreSQL | `cloudcampus-aws-rds` | PostgreSQL 16, db.t4g.micro, ap-southeast-1. Password auth. Master user `cloudcampus`; app user `cloudcampus_app` (DML only). |
| RDS security group | `cloudcampus-aws-rds-sg` | Inbound 5432 — scoped to dev IP(s); broad for Amplify SSR (see note below). |
| S3 bucket | `cloudcampus-aws-s3` | Block Public Access on, versioned, SSE-S3 encrypted. |
| IAM user | `cloudcampus-s3-user` | Programmatic access. Policy: `s3:{Get,Put,Delete}Object` on the bucket, `s3:ListBucket` on the bucket. Access keys set as Amplify env vars. |

The application code is wired to all three: PostgreSQL via `lib/db.ts`
(password from `DATABASE_URL`), S3 via `lib/s3.ts` (pre-signed URLs; static
access keys from env), sessions via signed JWT cookies.

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
   variables). The DB password and S3 access keys live here — there is no
   compute role to attach.

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://cloudcampus_app:<app-password>@<rds-endpoint>:5432/cloudcampus` |
   | `DATABASE_SSL` | `true` |
   | `JWT_SECRET` | a long random string (do not reuse the dev one) |
   | `S3_BUCKET` | `cloudcampus-aws-s3` |
   | `S3_REGION` | `ap-southeast-1` |
   | `S3_ACCESS_KEY_ID` | access key id for `cloudcampus-s3-user` |
   | `S3_SECRET_ACCESS_KEY` | secret access key for `cloudcampus-s3-user` |

4. **Deploy.** Amplify builds and deploys; subsequent pushes to `main`
   redeploy automatically.

> **Amplify SSR → RDS networking.** Amplify's managed compute has no fixed
> egress IP, so the RDS security group cannot be scoped to "just Amplify."
> The instance must be publicly accessible with 5432 open to a broad CIDR, or
> reachable via a VPC connector. This is independent of the auth method.

## RDS setup — one-time

1. **Create the app DB user.** Connected as the master user (`cloudcampus`):
   ```sql
   CREATE USER cloudcampus_app WITH PASSWORD '<app-password>';
   GRANT CONNECT ON DATABASE cloudcampus TO cloudcampus_app;
   GRANT USAGE ON SCHEMA public TO cloudcampus_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cloudcampus_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloudcampus_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cloudcampus_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO cloudcampus_app;
   ```
2. **Enforce SSL.** Apply a parameter group with `rds.force_ssl = 1` and set
   `DATABASE_SSL=true` in the app.

## Database migrations

Schema changes ship as ordered files in `cloudcampus/db/migrations/`. The
schema is currently a single consolidated migration, `0001_initial_schema.sql`.

The app user has DML grants only, so run migrations as the **master** user by
overriding `DATABASE_URL` on the command line. From `cloudcampus/`:

```
DATABASE_URL=postgresql://cloudcampus:<master-password>@<rds-endpoint>:5432/cloudcampus \
DATABASE_SSL=true npm run db:migrate
```

Then confirm the schema matches the code with `npm run db:check`.

## S3 setup — one-time

1. **Create the bucket** `cloudcampus-aws-s3` — Block Public Access on,
   versioning on, default SSE-S3 encryption.
2. **Create the IAM user** `cloudcampus-s3-user` (programmatic access only) with
   a policy scoped to the bucket:
   - `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on
     `arn:aws:s3:::cloudcampus-aws-s3/*`
   - `s3:ListBucket` on `arn:aws:s3:::cloudcampus-aws-s3`
3. **Generate one access-key pair** and set it as `S3_ACCESS_KEY_ID` /
   `S3_SECRET_ACCESS_KEY` in Amplify and local `.env`.

Verify the upload path end-to-end with `npm run s3:upload-check`.

## Post-deployment hardening

- **Lock down RDS** as far as the Amplify networking constraint allows (above);
  set the instance to publicly accessible only if required for reachability.
- **Rotate the S3 access keys** periodically; the static keys do not expire on
  their own.
- **Custom domain & HTTPS.** Amplify provisions HTTPS automatically; attach a
  custom domain via Amplify → Domain management if desired.

## Local development

See `cloudcampus/db/README.md`. In short: `docker compose up -d`, then
`npm run db:migrate`, create the first admin with
`node scripts/_create-admin.mjs admin@example.org change-me`, then
`npm run dev`.
