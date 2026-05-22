import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { togglePositionApprover, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/positions/[id]/approver — flip a position's approver flag
 * (FR-ADM-05). The database enforces exactly three approver positions.
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

  try {
    const result = await togglePositionApprover(id);
    if (!result) {
      return NextResponse.json(
        { error: "Position not found." },
        { status: 404 },
      );
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "UPDATE_POSITION_APPROVER",
      entity: "officer_positions",
      entityId: id,
      after: { name: result.name, isApprover: result.isApprover },
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
            "Exactly three positions must be approvers. Adjust another position first.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not update the position." },
      { status: 500 },
    );
  }
}
