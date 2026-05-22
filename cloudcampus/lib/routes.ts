import type { Role } from "@/lib/types";

// Central routing rules — used by proxy.ts (optimistic gate), the login flow,
// and the login page. Client-safe: pure functions, no server-only imports.

/** Where each role lands after signing in, when no return-to URL is given. */
export function homePathForRole(role: Role): string {
  return role === "admin" ? "/admin" : "/";
}

/**
 * Validates a `next` return-to value. Returns a safe internal path or null —
 * blocks open redirects, and avoids bouncing back into /login or the API.
 */
export function safeRedirectPath(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/api")) return null;
  return value;
}

/**
 * True for routes that require any signed-in user. Guests hitting these are
 * redirected to /login by proxy.ts; the pages themselves enforce the finer
 * role checks (member vs officer vs admin).
 *
 *   /admin, /admin/*          — admin
 *   /profile                 — member+
 *   /events/new, /approvals   — officer+
 *   /blogs/new, /projects/new — member+
 *   /members/<id>             — member+  (the /members list stays public)
 */
export function requiresAuthentication(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/profile") return true;
  if (pathname === "/events/new" || pathname === "/events/approvals") {
    return true;
  }
  if (pathname === "/blogs/new" || pathname === "/projects/new") return true;
  if (pathname.startsWith("/members/")) return true;
  return false;
}
