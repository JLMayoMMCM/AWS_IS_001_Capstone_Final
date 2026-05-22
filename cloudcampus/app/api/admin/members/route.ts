import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { registerMember, writeAudit } from "@/lib/queries";

/** POST /api/admin/members — register a new member account (FR-ADM-01). */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireRole("admin");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
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

  const data = body as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const fullName =
    typeof data.fullName === "string" ? data.fullName.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (!email || !fullName) {
    return NextResponse.json(
      { error: "Email and full name are required." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "The initial password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const memberId = await registerMember({ email, fullName, passwordHash });

    await writeAudit({
      actorUserId: session.userId,
      action: "REGISTER_MEMBER",
      entity: "members",
      entityId: memberId,
      after: { email, fullName },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json({ ok: true, memberId });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("unique") || raw.includes("duplicate")) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not register the member." },
      { status: 500 },
    );
  }
}
