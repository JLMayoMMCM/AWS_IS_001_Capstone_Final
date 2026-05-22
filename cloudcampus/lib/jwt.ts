import { SignJWT, jwtVerify } from "jose";

// Session JWT — signed, stored in an HttpOnly cookie (FR-AUTH-03, NFR-SEC-02).
//
// The token carries only stable identity (user id, member id, stored role).
// Officer status is NOT in the token; it is derived per-request from the
// officers table (FR-AUTH-08) — see lib/auth.ts.

export const SESSION_COOKIE = "cloudcampus_session";

/** 7 days, in seconds (FR-AUTH-04). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Role as persisted on the users row — guests and officers are derived. */
export type StoredRole = "member" | "admin";

export interface SessionToken {
  /** users.id */
  sub: string;
  /** members.id */
  memberId: string;
  role: StoredRole;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is not set (or too short). Add it to .env — see .env.example.",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Signs a session token valid for SESSION_MAX_AGE. */
export async function signSessionToken(token: SessionToken): Promise<string> {
  return new SignJWT({ memberId: token.memberId, role: token.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(token.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/** Verifies a session token; returns null if missing, expired, or tampered. */
export async function verifySessionToken(
  value: string,
): Promise<SessionToken | null> {
  try {
    const { payload } = await jwtVerify(value, secretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.memberId !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      memberId: payload.memberId,
      role: payload.role === "admin" ? "admin" : "member",
    };
  } catch {
    return null;
  }
}
