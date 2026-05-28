import { Pool } from "pg";

// Shared PostgreSQL connection pool for the application (FEAS §3.2).
//
// Server-side only — never import this from a client component. Used by API
// routes and server components. Migrations and the seed use their own
// short-lived clients (scripts/db-*.mjs).
//
// Authentication is password-based: the credentials are embedded in
// DATABASE_URL. Against RDS, set DATABASE_SSL=true so the connection is
// encrypted. Locally (Docker Postgres) leave DATABASE_SSL unset.
//
// The pool is cached on globalThis so Next.js hot-reloads in development do not
// open a new pool on every change.

const globalForDb = globalThis as unknown as {
  __cloudcampusPool?: Pool;
};

const ssl =
  process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

export const pool: Pool =
  globalForDb.__cloudcampusPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, ssl, max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__cloudcampusPool = pool;
}
