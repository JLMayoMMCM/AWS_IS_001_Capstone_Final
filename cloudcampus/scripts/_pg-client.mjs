// Shared PostgreSQL client factory for the db-* scripts. Mirrors lib/db.ts:
// when DATABASE_IAM_AUTH=true, mints an RDS IAM auth token per connection so
// migrations and the seed can run against the production RDS instance without
// a static password. Otherwise uses the password embedded in DATABASE_URL.

import pg from "pg";
import { Signer } from "@aws-sdk/rds-signer";

const useIamAuth = process.env.DATABASE_IAM_AUTH === "true";

export function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }
  const sslOn = useIamAuth || process.env.DATABASE_SSL === "true";
  const ssl = sslOn ? { rejectUnauthorized: false } : undefined;

  if (!useIamAuth) {
    return new pg.Client({ connectionString, ssl });
  }

  const url = new URL(connectionString);
  const host = url.hostname;
  const port = Number(url.port) || 5432;
  const user = decodeURIComponent(url.username);
  const database = url.pathname.replace(/^\//, "");
  const region = process.env.DATABASE_REGION ?? process.env.AWS_REGION;
  const signer = new Signer({ hostname: host, port, username: user, region });

  return new pg.Client({
    host,
    port,
    user,
    database,
    ssl,
    password: () => signer.getAuthToken(),
  });
}
