import pg from "pg";
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(
  `SELECT u.id, u.email, u.role, u.is_active, m.full_name
     FROM users u LEFT JOIN members m ON m.user_id = u.id
    WHERE u.email = $1`,
  [process.argv[2]],
);
console.log("rows:", r.rowCount);
console.log(r.rows);
await c.end();
