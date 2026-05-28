// Shared PostgreSQL client factory for the db-* scripts. Mirrors lib/db.ts:
// password-based auth using the credentials embedded in DATABASE_URL. Against
// RDS, set DATABASE_SSL=true so the connection is encrypted.

import pg from "pg";

export function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }
  const ssl =
    process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;
  return new pg.Client({ connectionString, ssl });
}
