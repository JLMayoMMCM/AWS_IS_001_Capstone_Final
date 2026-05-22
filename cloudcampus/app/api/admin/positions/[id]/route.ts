import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { deletePosition, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/positions/[id] — removes an officer position (FR-ADM-05).
 * The database blocks removing an approver position or one with officers.
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

  try {
    const name = await deletePosition(id);
    if (!name) {
      return NextResponse.json(
        { error: "Position not found." },
        { status: 404 },
      );
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "DELETE_POSITION",
      entity: "officer_positions",
      entityId: null,
      after: { name },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("exactly 3")) {
      return NextResponse.json(
        {
          error:
            "Approver positions cannot be deleted. Remove its approver status first.",
        },
        { status: 409 },
      );
    }
    if (raw.includes("foreign key") || raw.includes("violates")) {
      return NextResponse.json(
        {
          error:
            "This position has officer history and cannot be deleted.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not delete the position." },
      { status: 500 },
    );
  }
}
