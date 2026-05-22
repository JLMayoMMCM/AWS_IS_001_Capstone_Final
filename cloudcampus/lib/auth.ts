import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  verifySessionToken,
  type SessionToken,
} from "@/lib/jwt";
import { isCurrentOfficer } from "@/lib/queries";
import { GUEST_SESSION, type Session } from "@/lib/session";
import type { Role } from "@/lib/types";

// Server-only authentication helpers. Never import from a client component.

/**
 * Resolves the current session from the request cookie.
 *
 * The token holds the stored role ('member' | 'admin'); officer status is
 * derived here per request from the officers table (FR-AUTH-08) so officer
 * turnover takes effect immediately without re-issuing tokens.
 */
export async function getSession(): Promise<Session> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return GUEST_SESSION;

  const payload = await verifySessionToken(token);
  if (!payload) return GUEST_SESSION;

  let role: Role = payload.role;
  if (role !== "admin") {
    role = (await isCurrentOfficer(payload.memberId)) ? "officer" : "member";
  }

  return { role, userId: payload.sub, memberId: payload.memberId };
}

/** Issues a session cookie: HttpOnly, Secure in production, SameSite=Lax. */
export async function setSessionCookie(token: SessionToken): Promise<void> {
  const jwt = await signSessionToken(token);
  (await cookies()).set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Clears the session cookie (FR-AUTH-05). */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Verifies a plaintext password against a bcrypt hash (FR-AUTH-02). */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** True if the session holds any of the given roles. */
export function hasRole(session: Session, ...roles: Role[]): boolean {
  return roles.includes(session.role);
}

/**
 * Asserts a minimum role for an API route, treating the role hierarchy as
 * guest < member < officer < admin. Returns the session, or throws an
 * AuthError carrying the HTTP status to return (NFR-SEC-08).
 */
const ROLE_RANK: Record<Role, number> = {
  guest: 0,
  member: 1,
  officer: 2,
  admin: 3,
};

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

export async function requireRole(minimum: Role): Promise<Session> {
  const session = await getSession();
  if (ROLE_RANK[session.role] < ROLE_RANK[minimum]) {
    throw new AuthError(
      session.role === "guest" ? 401 : 403,
      session.role === "guest"
        ? "Authentication required."
        : "You do not have permission to perform this action.",
    );
  }
  return session;
}

/** Converts a thrown AuthError into an API response; rethrows anything else. */
export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
