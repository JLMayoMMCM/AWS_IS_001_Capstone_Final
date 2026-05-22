// Applies pending SQL migrations from db/migrations in filename order.
// Each migration runs in its own transaction; applied files are recorded in
// the schema_migrations table so re-runs are safe.
//
//   node --env-file-if-exists=.env scripts/db-migrate.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "db", "migrations");

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
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      process.stdout.write(`Applying ${file} ... `);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log("done");
        count += 1;
      } catch (err) {
        await client.query("ROLLBACK");
        console.log("failed");
        throw err;
      }
    }

    console.log(
      count > 0 ? `Applied ${count} migration(s).` : "No new migrations.",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`Migration error: ${err.message ?? err}`);
  process.exit(1);
});
