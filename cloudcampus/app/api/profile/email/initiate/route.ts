import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { emailConfigured, sendEmailChangeConfirmation } from "@/lib/email";
import {
  EmailTakenError,
  storeEmailChangeRequest,
} from "@/lib/queries";
import { pool } from "@/lib/db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/profile/email/initiate
 * The logged-in member proves their current password, then asks to switch
 * their account email to `newEmail`. A confirmation token is emailed to the
 * NEW address; account email is not touched until /api/profile/email/confirm
 * consumes the token. (V2.1 §4)
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireRole("member");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  if (!emailConfigured) {
    return NextResponse.json(
      { error: "Email is not configured on this server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const data = body as { newEmail?: unknown; currentPassword?: unknown };
  const newEmail =
    typeof data.newEmail === "string" ? data.newEmail.trim() : "";
  const currentPassword =
    typeof data.currentPassword === "string" ? data.currentPassword : "";
  if (!EMAIL_RE.test(newEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (!currentPassword) {
    return NextResponse.json(
      { error: "Confirm with your current password." },
      { status: 400 },
    );
  }

  // Re-auth: verify the current password.
  const { rows } = await pool.query(
    `SELECT email, password_hash FROM users WHERE id = $1`,
    [session.userId],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "That password is incorrect." },
      { status: 403 },
    );
  }
  if ((rows[0].email as string).toLowerCase() === newEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "That is already your account email." },
      { status: 400 },
    );
  }

  // Issue the token and store its hash.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  try {
    await storeEmailChangeRequest({
      userId: session.userId,
      newEmail,
      tokenHash,
      expiresAt,
    });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json(
        { error: "That email address is already in use." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not start the email change." },
      { status: 500 },
    );
  }

  const delivered = await sendEmailChangeConfirmation({
    to: newEmail,
    token,
  });
  return NextResponse.json({ ok: true, delivered });
}
