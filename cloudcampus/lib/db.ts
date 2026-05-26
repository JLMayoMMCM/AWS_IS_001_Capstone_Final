import { Pool, type PoolConfig } from "pg";
import { Signer } from "@aws-sdk/rds-signer";

// Shared PostgreSQL connection pool for the application (FEAS §3.2).
//
// Server-side only — never import this from a client component. Used from
// Phase 4 onward by API routes and server components. Migrations and the seed
// use their own short-lived clients (scripts/db-*.mjs).
//
// In production the Amplify compute role authenticates to RDS via IAM:
// DATABASE_IAM_AUTH=true makes the pool mint a short-lived auth token (≤15
// min) per new connection through @aws-sdk/rds-signer, so no DB password
// lives in env vars. Locally (Docker Postgres), DATABASE_IAM_AUTH is unset
// and the password embedded in DATABASE_URL is used as before.
//
// The pool is cached on globalThis so Next.js hot-reloads in development do not
// open a new pool on every change.

const useIamAuth = process.env.DATABASE_IAM_AUTH === "true";

function buildPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  const sslOn =
    useIamAuth || process.env.DATABASE_SSL === "true";
  const ssl = sslOn ? { rejectUnauthorized: false } : undefined;

  if (!useIamAuth) {
    return { connectionString, ssl, max: 10 };
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for IAM authentication");
  }
  const url = new URL(connectionString);
  const host = url.hostname;
  const port = Number(url.port) || 5432;
  const user = decodeURIComponent(url.username);
  const database = url.pathname.replace(/^\//, "");
  const region =
    process.env.DATABASE_REGION ?? process.env.AWS_REGION;

  const signer = new Signer({ hostname: host, port, username: user, region });

  return {
    host,
    port,
    user,
    database,
    ssl,
    max: 10,
    // pg calls this on each new physical connection; the token is short-lived
    // but rds-signer mints a fresh one every time.
    password: () => signer.getAuthToken(),
  };
}

const globalForDb = globalThis as unknown as {
  __cloudcampusPool?: Pool;
};

export const pool: Pool =
  globalForDb.__cloudcampusPool ?? new Pool(buildPoolConfig());

if (process.env.NODE_ENV !== "production") {
  globalForDb.__cloudcampusPool = pool;
}
