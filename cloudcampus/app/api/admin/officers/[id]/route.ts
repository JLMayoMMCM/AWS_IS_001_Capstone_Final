import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { endOfficerTerm, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/officers/[id] — ends a current officer assignment
 * (FR-ADM-04). The row is kept as officer history, not deleted.
 */
export async function DELETE(request: Request, { params }: Params) {
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

  const result = await endOfficerTerm(id);
  if (!result) {
    return NextResponse.json(
      { error: "Officer assignment not found." },
      { status: 404 },
    );
  }

  await writeAudit({
    actorUserId: session.userId,
    action: "REMOVE_OFFICER",
    entity: "officers",
    entityId: null,
    after: { member: result.memberName, position: result.positionName },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
