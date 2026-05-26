import { randomBytes, createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { sendPasswordResetEmail } from "@/lib/email";
import { findUserIdByEmail, storePasswordResetToken } from "@/lib/queries";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

/** POST /api/auth/forgot-password — emails a reset link if the email exists. */
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

  const email =
    typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim()
      : "";
  if (!email) {
    return NextResponse.json(
      { error: "Email is required." },
      { status: 400 },
    );
  }

  // Always return ok=true even if the account doesn't exist, so the response
  // doesn't reveal which emails are registered.
  try {
    const userId = await findUserIdByEmail(email);
    if (userId) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
      await storePasswordResetToken({ userId, tokenHash, expiresAt });
      await sendPasswordResetEmail({ to: email, token });
    }
  } catch (err) {
    console.error("[forgot-password]", err);
  }
  return NextResponse.json({ ok: true });
}
