// Read-only schema-alignment check: runs the queries the app depends on after
// migration 0002 and reports whether each succeeds against the database.
//
//   node --env-file-if-exists=.env scripts/db-check.mjs

import { makeClient } from "./_pg-client.mjs";

// [label, SQL, mustReturnRows?] — every statement is read-only.
const checks = [
  [
    "schema migration recorded",
    `SELECT 1 FROM schema_migrations WHERE filename = '0001_initial_schema.sql'`,
    true,
  ],
  [
    "lookup tables exist",
    `SELECT
       (SELECT count(*) FROM courses),
       (SELECT count(*) FROM year_levels),
       (SELECT count(*) FROM member_statuses),
       (SELECT count(*) FROM project_categories),
       (SELECT count(*) FROM form_providers)`,
  ],
  [
    "members joined to lookups (MEMBER_SELECT)",
    `SELECT m.id, m.full_name, m.student_id, m.contact_email, m.bio, u.role,
            c.name AS course, y.display_order AS year_level, s.name AS status
       FROM members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN courses c ON c.id = m.course_id
       LEFT JOIN year_levels y ON y.id = m.year_level_id
       LEFT JOIN member_statuses s ON s.id = m.status_id
      LIMIT 1`,
  ],
  [
    "form_links joined to form_providers (listForms / listAllForms)",
    `SELECT f.id, f.title, lower(p.name) AS provider, f.url, f.embed_url
       FROM form_links f
       LEFT JOIN form_providers p ON p.id = f.provider_id
      LIMIT 1`,
  ],
  [
    "dashboard active-member count",
    `SELECT count(*) FROM members m
       JOIN member_statuses s ON s.id = m.status_id
      WHERE s.name = 'Active'`,
  ],
  [
    "projects.category_id present (PROJECT_SELECT)",
    `SELECT category_id FROM projects LIMIT 1`,
  ],
  [
    "project contributor course resolves",
    `SELECT (SELECT name FROM courses WHERE id = m.course_id) AS course
       FROM members m LIMIT 1`,
  ],
];

// Old columns/types that migration 0002 must have removed.
const removed = [
  ["members.course", `SELECT course FROM members LIMIT 1`],
  ["members.year_level", `SELECT year_level FROM members LIMIT 1`],
  ["members.status", `SELECT status FROM members LIMIT 1`],
  ["form_links.provider", `SELECT provider FROM form_links LIMIT 1`],
];

async function main() {
  const client = makeClient();
  await client.connect();
  let failures = 0;
  try {
    for (const [label, sql, mustReturnRows] of checks) {
      try {
        const result = await client.query(sql);
        if (mustReturnRows && result.rowCount === 0) {
          throw new Error("expected a row, found none");
        }
        console.log(`  PASS  ${label}`);
      } catch (err) {
        failures += 1;
        console.log(`  FAIL  ${label} — ${err.message}`);
      }
    }
    for (const [label, sql] of removed) {
      try {
        await client.query(sql);
        failures += 1;
        console.log(`  FAIL  ${label} should no longer exist`);
      } catch {
        console.log(`  PASS  ${label} removed`);
      }
    }
  } finally {
    await client.end();
  }
  console.log(
    failures === 0
      ? "\nAll checks passed — the schema is aligned."
      : `\n${failures} check(s) failed — the database is not aligned.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`Check error: ${err.message ?? err}`);
  process.exit(1);
});
