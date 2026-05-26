import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { consumePasswordResetToken } from "@/lib/queries";

/** POST /api/auth/reset-password — exchanges a reset token for a new password. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const data = body as { token?: unknown; password?: unknown };
  const token = typeof data.token === "string" ? data.token : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!token || !password) {
    return NextResponse.json(
      { error: "Token and password are required." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const ok = await consumePasswordResetToken(tokenHash, passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json(
      { error: "Could not reset the password." },
      { status: 500 },
    );
  }
}
