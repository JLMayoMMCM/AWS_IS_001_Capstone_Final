import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { assignOfficer, writeAudit } from "@/lib/queries";

/**
 * POST /api/admin/officers — assigns a member to an officer position for a
 * school year (FR-ADM-04). Replaces the position's current holder, if any.
 */
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
  const memberId = typeof data.memberId === "string" ? data.memberId : "";
  const positionId =
    typeof data.positionId === "string" ? data.positionId : "";
  const termLabel =
    typeof data.termLabel === "string" ? data.termLabel.trim() : "";

  if (!memberId || !positionId || !termLabel) {
    return NextResponse.json(
      { error: "A member, position and school year are required." },
      { status: 400 },
    );
  }

  try {
    const result = await assignOfficer({ memberId, positionId, termLabel });
    if (!result) {
      return NextResponse.json(
        { error: "That member or position no longer exists." },
        { status: 404 },
      );
    }

    await writeAudit({
      actorUserId: session.userId,
      action: "ASSIGN_OFFICER",
      entity: "officers",
      entityId: null,
      after: {
        member: result.memberName,
        position: result.positionName,
        term: termLabel,
      },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not assign the officer." },
      { status: 500 },
    );
  }
}
