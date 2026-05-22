import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { setMemberAdmin, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/members/[id]/role — grant or revoke the admin role
 * (FR-ADM-03). An admin may not revoke their own admin role.
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

  const makeAdmin = (body as { admin?: unknown }).admin === true;

  // FR-ADM-03 — an admin cannot revoke their own admin role.
  if (!makeAdmin && id === session.memberId) {
    return NextResponse.json(
      { error: "You cannot revoke your own admin role." },
      { status: 403 },
    );
  }

  const name = await setMemberAdmin(id, makeAdmin);
  if (!name) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: makeAdmin ? "PROMOTE_ADMIN" : "REVOKE_ADMIN",
    entity: "members",
    entityId: id,
    after: { name, role: makeAdmin ? "admin" : "member" },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
