import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { setBlogStatus, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/blogs/[id]/status — approve or reject a blog (FR-ADM-06). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  let session;
  try {
    session = await requireRole("admin");
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
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'." },
      { status: 400 },
    );
  }

  const title = await setBlogStatus(id, status, session.memberId);
  if (!title) {
    return NextResponse.json({ error: "Blog not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: status === "approved" ? "APPROVE_BLOG" : "REJECT_BLOG",
    entity: "blogs",
    entityId: id,
    after: { title, status },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
