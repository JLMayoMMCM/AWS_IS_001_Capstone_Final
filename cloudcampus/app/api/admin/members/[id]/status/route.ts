import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { setMemberActive, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/members/[id]/status — activates or deactivates a member
 * account (FR-ADM-02). A deactivated member loses login access.
 */
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

  const active = (body as { active?: unknown }).active === true;

  // An admin must not lock themselves out of their own account.
  if (!active && session.memberId === id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account." },
      { status: 409 },
    );
  }

  const name = await setMemberActive(id, active);
  if (!name) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: active ? "REACTIVATE_MEMBER" : "DEACTIVATE_MEMBER",
    entity: "members",
    entityId: id,
    after: { name },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return NextResponse.json({ ok: true });
}
