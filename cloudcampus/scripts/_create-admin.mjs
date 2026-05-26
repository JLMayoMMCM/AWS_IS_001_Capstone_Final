// Create (or update) an admin user. Idempotent.
//   DATABASE_URL=... DATABASE_SSL=true \
//   node scripts/_create-admin.mjs <email> <password> <full_name>

import pg from "pg";
import bcrypt from "bcryptjs";

const [, , email, password, fullName] = process.argv;
if (!email || !password) {
  console.error("Usage: _create-admin.mjs <email> <password> <full_name>");
  process.exit(1);
}

const name = fullName ?? email.split("@")[0];
const passwordHash = await bcrypt.hash(password, 12);

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

await c.query("BEGIN");
try {
  const existing = await c.query(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );

  let userId;
  if (existing.rowCount === 0) {
    const u = await c.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', true)
       RETURNING id`,
      [email, passwordHash],
    );
    userId = u.rows[0].id;
    await c.query(
      `INSERT INTO members (user_id, full_name, contact_email, status_id)
       SELECT $1, $2, $3, (SELECT id FROM member_statuses WHERE name = 'Active' LIMIT 1)`,
      [userId, name, email],
    );
    console.log(`Created user ${email} (id=${userId}) and member row.`);
  } else {
    userId = existing.rows[0].id;
    await c.query(
      "UPDATE users SET password_hash = $1, role = 'admin', is_active = true WHERE id = $2",
      [passwordHash, userId],
    );
    const memberExists = await c.query(
      "SELECT 1 FROM members WHERE user_id = $1",
      [userId],
    );
    if (memberExists.rowCount === 0) {
      await c.query(
        `INSERT INTO members (user_id, full_name, contact_email, status_id)
         SELECT $1, $2, $3, (SELECT id FROM member_statuses WHERE name = 'Active' LIMIT 1)`,
        [userId, name, email],
      );
    }
    console.log(`Updated user ${email} (id=${userId}); password reset.`);
  }
  await c.query("COMMIT");
} catch (err) {
  await c.query("ROLLBACK");
  throw err;
}

await c.end();
