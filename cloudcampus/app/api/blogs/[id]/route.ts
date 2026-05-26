import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import {
  EditNotAllowedError,
  parseAttachments,
  updateBlog,
} from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/blogs/[id] — the author edits their own blog. Status flips back
 * to 'pending' and re-enters the approval queue (V2.1 §1.3). Rejected blogs
 * cannot be edited.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  let session;
  try {
    session = await requireRole("member");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId) {
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
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const bodyMarkdown =
    typeof data.bodyMarkdown === "string" ? data.bodyMarkdown.trim() : "";
  const visibility = data.visibility === "private" ? "private" : "public";
  if (!title || !bodyMarkdown) {
    return NextResponse.json(
      { error: "A title and body are required." },
      { status: 400 },
    );
  }

  try {
    await updateBlog({
      id,
      memberId: session.memberId,
      isAdmin: session.role === "admin",
      title,
      bodyMarkdown,
      visibility,
      coverS3Key:
        typeof data.coverKey === "string" && data.coverKey
          ? data.coverKey
          : null,
      attachments: parseAttachments(data.attachments),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EditNotAllowedError) {
      const status =
        err.reason === "not_found"
          ? 404
          : err.reason === "rejected"
            ? 409
            : 403;
      const message =
        err.reason === "not_found"
          ? "Blog post not found."
          : err.reason === "rejected"
            ? "Rejected posts cannot be edited. Please submit a new draft."
            : "You can only edit your own posts.";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Could not save the post. Please try again." },
      { status: 500 },
    );
  }
}
