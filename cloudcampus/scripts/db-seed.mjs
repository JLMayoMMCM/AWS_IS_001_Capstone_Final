// Seeds a freshly migrated database with one placeholder row per table and a
// bootstrap admin account. Safe to run repeatedly — it skips a non-empty
// database. Run migrations first.
//
//   node --env-file-if-exists=.env scripts/db-seed.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_EMAIL = "admin@cloudcampus.example";

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }
  return new pg.Client({
    connectionString,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

async function main() {
  const client = makeClient();
  await client.connect();
  try {
    const { rows: reg } = await client.query(
      "SELECT to_regclass('public.users') AS tbl",
    );
    if (!reg[0].tbl) {
      console.error("Tables not found. Run `npm run db:migrate` first.");
      process.exit(1);
    }

    const { rows: count } = await client.query(
      "SELECT count(*)::int AS n FROM users",
    );
    if (count[0].n > 0) {
      console.log("Database already has data — skipping seed.");
      return;
    }

    const sql = readFileSync(join(root, "db", "seed.sql"), "utf8");
    const password = process.env.SEED_ADMIN_PASSWORD || "CloudCampus!2026";
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE email = $2",
        [passwordHash, ADMIN_EMAIL],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    console.log("Seed complete.");
    console.log(`  Admin login: ${ADMIN_EMAIL}`);
    console.log(`  Admin password: ${password}  (change after first login)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`Seed error: ${err.message ?? err}`);
  process.exit(1);
});
