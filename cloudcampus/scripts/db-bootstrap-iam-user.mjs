// One-shot bootstrap: connect as the RDS master user and create the
// IAM-auth application user (cloudcampus_app). Run once, right after the
// schema has been migrated.
//
//   DATABASE_URL=postgresql://cloudcampus:<master-pw>@<endpoint>:5432/cloudcampus \
//   DATABASE_SSL=true \
//   node scripts/db-bootstrap-iam-user.mjs

import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be the master-user connection string.");
  process.exit(1);
}

const ssl =
  process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined;

const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
try {
  // CREATE USER is idempotent enough via DO block.
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudcampus_app') THEN
        CREATE USER cloudcampus_app;
      END IF;
    END $$;
  `);
  await client.query(`GRANT rds_iam TO cloudcampus_app;`);
  await client.query(`GRANT CONNECT ON DATABASE cloudcampus TO cloudcampus_app;`);
  await client.query(`GRANT USAGE ON SCHEMA public TO cloudcampus_app;`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cloudcampus_app;`,
  );
  await client.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloudcampus_app;`,
  );
  await client.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cloudcampus_app;
  `);
  await client.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO cloudcampus_app;
  `);
  const { rows } = await client.query(
    `SELECT rolname, rolinherit, rolcanlogin FROM pg_roles WHERE rolname = 'cloudcampus_app'`,
  );
  console.log("cloudcampus_app created/refreshed:", rows[0]);
  console.log("Done.");
} finally {
  await client.end();
}
