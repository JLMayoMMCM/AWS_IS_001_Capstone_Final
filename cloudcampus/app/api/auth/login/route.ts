import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { findAuthUserByEmail } from "@/lib/queries";
import { homePathForRole, safeRedirectPath } from "@/lib/routes";
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/rate-limit";

// A throwaway hash so a missing user still costs one bcrypt comparison,
// keeping response time uniform whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("cloudcampus-dummy-password", 12);

/** POST /api/auth/login — verify credentials and issue a session cookie. */
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

  const data = body as {
    email?: unknown;
    password?: unknown;
    next?: unknown;
  };
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  // FR-AUTH-09 / NFR-SEC-10 — rate limit per email.
  const limit = checkLoginRateLimit(email);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again later." },
      {
        status: 429,
        headers: limit.retryAfterSeconds
          ? { "Retry-After": String(limit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const user = await findAuthUserByEmail(email);

  let passwordOk = false;
  if (user) {
    passwordOk = await verifyPassword(password, user.passwordHash);
  } else {
    await bcrypt.compare(password, DUMMY_HASH); // equalize timing
  }

  // One generic message — never reveal which factor failed.
  if (!user || !user.isActive || !passwordOk) {
    recordFailedLogin(email);
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  clearLoginAttempts(email);
  await setSessionCookie({
    sub: user.id,
    memberId: user.memberId,
    role: user.role,
  });

  // A valid return-to URL wins; otherwise land each role on its home page.
  const next = safeRedirectPath(
    typeof data.next === "string" ? data.next : null,
  );
  const redirect = next ?? homePathForRole(user.role);

  return NextResponse.json({ ok: true, redirect });
}
