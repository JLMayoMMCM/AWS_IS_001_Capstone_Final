// TEMPORARY diagnostic — delete once the IAM-auth path is verified in prod.
// Reports whether the SSR Lambda can mint an RDS auth token and run SELECT 1.
// No secrets are returned; the response is intentionally safe to log.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
    DATABASE_SSL: process.env.DATABASE_SSL ?? null,
    DATABASE_IAM_AUTH: process.env.DATABASE_IAM_AUTH ?? null,
    DATABASE_REGION: process.env.DATABASE_REGION ?? null,
    AWS_REGION: process.env.AWS_REGION ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
    AMPLIFY_MONOREPO_APP_ROOT: process.env.AMPLIFY_MONOREPO_APP_ROOT ?? null,
  };

  const started = Date.now();
  try {
    const { rows } = await pool.query(
      "SELECT current_user AS user, current_database() AS db, version() AS version",
    );
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - started,
      env,
      row: rows[0],
    });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string; name?: string };
    return NextResponse.json(
      {
        ok: false,
        durationMs: Date.now() - started,
        env,
        error: {
          name: e?.name ?? null,
          code: e?.code ?? null,
          message: e?.message ?? String(err),
        },
      },
      { status: 500 },
    );
  }
}
