// Quick read-only sanity check: is the seeded admin user present, active,
// with a usable password hash? Compares the stored hash against the seed
// password to confirm bcrypt verifies.

import pg from "pg";
import bcrypt from "bcryptjs";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});
await client.connect();

const total = await client.query("SELECT count(*)::int AS n FROM users");
console.log(`total users in DB: ${total.rows[0].n}`);

const r = await client.query(
  `SELECT id, email, role, is_active,
          length(password_hash) AS hash_len,
          left(password_hash, 7) AS hash_prefix,
          password_hash
     FROM users
    WHERE email = 'admin@cloudcampus.example'`,
);
console.log(`rows matching admin@cloudcampus.example: ${r.rowCount}`);
for (const row of r.rows) {
  const { password_hash, ...rest } = row;
  console.log(rest);
  const ok = await bcrypt.compare("CloudCampus!2026", password_hash);
  console.log(`  bcrypt.compare('CloudCampus!2026', stored_hash) -> ${ok}`);
}

await client.end();
