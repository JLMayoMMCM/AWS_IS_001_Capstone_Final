import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { setBlogStatus, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

const ACTION: Record<string, string> = {
  approved: "APPROVE_BLOG",
  rejected: "REJECT_BLOG",
  archived: "ARCHIVE_BLOG",
};

/** POST /api/admin/blogs/[id]/status — approve/reject/archive (FR-ADM-06). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  // V2.1: officers + admins approve blogs from the queue OR inline.
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

  const title = await setBlogStatus(id, status, session.memberId);
  if (!title) {
    return NextResponse.json({ error: "Blog not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: ACTION[status],
    entity: "blogs",
    entityId: id,
    after: { title, status },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
