// Staged diagnostic for the IAM-authenticated DB path. Walks through:
//   1. Env vars present
//   2. DATABASE_URL parses into host/port/user/db
//   3. AWS credentials resolvable
//   4. rds-signer mints an auth token
//   5. pg can open a connection with the token and run SELECT 1
//
// Each step prints PASS / FAIL with a hint so you can fix one thing at a time.
//
//   node --env-file-if-exists=.env scripts/db-iam-check.mjs

import { Signer } from "@aws-sdk/rds-signer";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import pg from "pg";

function log(state, label, hint) {
  const tag = state === "ok" ? "PASS" : state === "skip" ? "SKIP" : "FAIL";
  console.log(`  ${tag.padEnd(4)}  ${label}${hint ? ` — ${hint}` : ""}`);
}

async function main() {
  let failed = false;

  // ---- 1. env vars ----
  const url = process.env.DATABASE_URL;
  const iam = process.env.DATABASE_IAM_AUTH === "true";
  const region = process.env.DATABASE_REGION ?? process.env.AWS_REGION;
  if (!url) {
    log("fail", "DATABASE_URL set", "missing");
    process.exit(1);
  }
  log("ok", "DATABASE_URL set");
  if (!iam) {
    log("fail", "DATABASE_IAM_AUTH=true", "set DATABASE_IAM_AUTH=true to exercise the IAM path");
    process.exit(1);
  }
  log("ok", "DATABASE_IAM_AUTH=true");
  if (!region) {
    log("fail", "region resolved", "set DATABASE_REGION or AWS_REGION");
    process.exit(1);
  }
  log("ok", `region resolved (${region})`);

  // ---- 2. parse DATABASE_URL ----
  let host, port, user, database;
  try {
    const u = new URL(url);
    host = u.hostname;
    port = Number(u.port) || 5432;
    user = decodeURIComponent(u.username);
    database = u.pathname.replace(/^\//, "");
    if (!host || !user || !database) throw new Error("missing host/user/database");
    log("ok", `DATABASE_URL parses (user=${user}, host=${host}, port=${port}, db=${database})`);
  } catch (err) {
    log("fail", "DATABASE_URL parses", err.message);
    process.exit(1);
  }

  // ---- 3. AWS credentials ----
  try {
    const creds = await defaultProvider()();
    const masked = creds.accessKeyId
      ? `${creds.accessKeyId.slice(0, 4)}…${creds.accessKeyId.slice(-4)}`
      : "(none)";
    log("ok", `AWS credentials resolvable (${masked})`);
  } catch (err) {
    log("fail", "AWS credentials resolvable", err.message);
    return;
  }

  // ---- 4. rds-signer mints a token ----
  let token;
  try {
    const signer = new Signer({ hostname: host, port, username: user, region });
    token = await signer.getAuthToken();
    log("ok", `rds-signer issued token (${token.length} chars)`);
  } catch (err) {
    log("fail", "rds-signer issued token", err.message);
    return;
  }

  // ---- 5. pg connects ----
  const client = new pg.Client({
    host,
    port,
    user,
    database,
    ssl: { rejectUnauthorized: false },
    password: () => token,
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const { rows } = await client.query("SELECT current_user, current_database(), 1 AS ok");
    log("ok", `pg connect + SELECT 1 (user=${rows[0].current_user}, db=${rows[0].current_database})`);
  } catch (err) {
    failed = true;
    log("fail", "pg connect + SELECT 1", err.message);
  } finally {
    try { await client.end(); } catch {}
  }

  if (failed) process.exit(1);
  console.log("\nAll IAM-auth checks passed.");
}

main().catch((err) => {
  console.error(`\nUnexpected error: ${err.message ?? err}`);
  process.exit(1);
});
