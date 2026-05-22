import { Pool } from "pg";

// Shared PostgreSQL connection pool for the application (FEAS §3.2).
//
// Server-side only — never import this from a client component. Used from
// Phase 4 onward by API routes and server components. Migrations and the seed
// use their own short-lived clients (scripts/db-*.mjs).
//
// The pool is cached on globalThis so Next.js hot-reloads in development do not
// open a new pool on every change.

const globalForDb = globalThis as unknown as {
  __cloudcampusPool?: Pool;
};

export const pool: Pool =
  globalForDb.__cloudcampusPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // RDS requires SSL (rds.force_ssl = 1); local Docker Postgres does not.
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__cloudcampusPool = pool;
}
