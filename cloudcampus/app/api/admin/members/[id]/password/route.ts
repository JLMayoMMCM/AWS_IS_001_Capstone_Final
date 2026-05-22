import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { resetMemberPassword, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/members/[id]/password — sets a new password (FR-ADM-02). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

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

  const password =
    typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";
  if (password.length < 8) {
    return NextResponse.json(
      { error: "The new password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const name = await resetMemberPassword(id, passwordHash);
  if (!name) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: "RESET_MEMBER_PASSWORD",
    entity: "members",
    entityId: id,
    after: { name },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return NextResponse.json({ ok: true });
}
