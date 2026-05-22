import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/jwt";
import { requiresAuthentication } from "@/lib/routes";

// Next.js 16 Proxy (formerly Middleware). It is the optimistic guest gate:
// routes that need a signed-in user redirect guests to /login with a return-to
// link. It is NOT the security boundary — every protected page and API route
// re-checks the session and the exact role server-side (NFR-SEC-08).

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (requiresAuthentication(pathname) && !request.cookies.get(SESSION_COOKIE)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
