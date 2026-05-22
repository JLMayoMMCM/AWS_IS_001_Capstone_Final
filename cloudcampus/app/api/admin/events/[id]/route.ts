import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import {
  cancelEvent,
  deleteEvent,
  forceApproveEvent,
  writeAudit,
} from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/events/[id] — admin event override (FR-ADM-08/09).
 * Body: { action: "force-approve" | "cancel" | "delete" }.
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

  const action = (body as { action?: unknown }).action;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  let title: string | null;
  let auditAction: string;

  if (action === "force-approve") {
    title = await forceApproveEvent(id);
    auditAction = "FORCE_APPROVE_EVENT";
  } else if (action === "cancel") {
    title = await cancelEvent(id);
    auditAction = "CANCEL_EVENT";
  } else if (action === "delete") {
    title = await deleteEvent(id);
    auditAction = "DELETE_EVENT";
  } else {
    return NextResponse.json(
      { error: "action must be 'force-approve', 'cancel', or 'delete'." },
      { status: 400 },
    );
  }

  if (!title) {
    return NextResponse.json(
      { error: "Event not found, or not in a state that allows this action." },
      { status: 404 },
    );
  }

  await writeAudit({
    actorUserId: session.userId,
    action: auditAction,
    entity: "events",
    entityId: action === "delete" ? null : id,
    after: { title },
    ip,
  });

  return NextResponse.json({ ok: true });
}
