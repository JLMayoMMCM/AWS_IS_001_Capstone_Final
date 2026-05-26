import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  consumeEmailChangeToken,
  EmailTakenError,
} from "@/lib/queries";

/**
 * POST /api/profile/email/confirm — consumes the token mailed to the new
 * address and swaps users.email atomically. No session required: possession
 * of the unique unhashed token is the auth signal. (V2.1 §4)
 */
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
  const token = (body as { token?: unknown }).token;
  if (typeof token !== "string" || !token) {
    return NextResponse.json(
      { error: "Missing confirmation token." },
      { status: 400 },
    );
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");

  try {
    const result = await consumeEmailChangeToken(tokenHash);
    if (!result) {
      return NextResponse.json(
        { error: "This link is invalid or has expired." },
        { status: 410 },
      );
    }
    return NextResponse.json({ ok: true, newEmail: result.newEmail });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json(
        { error: "That email address is already in use." },
        { status: 409 },
      );
    }
    console.error("[email-change] confirm failed:", err);
    return NextResponse.json(
      { error: "Could not confirm the change." },
      { status: 500 },
    );
  }
}
