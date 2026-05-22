import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth";

/** POST /api/auth/logout — clear the session cookie (FR-AUTH-05). */
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
