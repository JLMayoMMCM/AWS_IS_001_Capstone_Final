import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { setProjectStatus, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

const ACTION: Record<string, string> = {
  approved: "APPROVE_PROJECT",
  rejected: "REJECT_PROJECT",
  archived: "ARCHIVE_PROJECT",
};

/** POST /api/admin/projects/[id]/status — approve/reject/archive (FR-ADM-07). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  // V2.1: officers + admins act on projects from the queue OR inline.
  let session;
  try {
    session = await requireRole("officer");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId || !session.userId) {
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

  const status = (body as { status?: unknown }).status;
  if (status !== "approved" && status !== "rejected" && status !== "archived") {
    return NextResponse.json(
      { error: "status must be 'approved', 'rejected', or 'archived'." },
      { status: 400 },
    );
  }

  const title = await setProjectStatus(id, status, session.memberId);
  if (!title) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: ACTION[status],
    entity: "projects",
    entityId: id,
    after: { title, status },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
