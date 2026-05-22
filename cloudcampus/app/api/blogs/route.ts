import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createBlog, parseAttachments } from "@/lib/queries";

/** POST /api/blogs — a member submits a blog post for review (FR-MEM-06). */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireRole("member");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId) {
    return NextResponse.json(
      { error: "No member profile is linked to this account." },
      { status: 400 },
    );
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

  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  if (!bodyMarkdown) {
    return NextResponse.json(
      { error: "The post body cannot be empty." },
      { status: 400 },
    );
  }

  try {
    const coverKey =
      typeof data.coverKey === "string" && data.coverKey
        ? data.coverKey
        : null;
    const slug = await createBlog({
      authorId: session.memberId,
      title,
      bodyMarkdown,
      visibility,
      coverS3Key: coverKey,
      attachments: parseAttachments(data.attachments),
    });
    return NextResponse.json({ ok: true, slug });
  } catch {
    return NextResponse.json(
      { error: "Could not save the post. Please try again." },
      { status: 500 },
    );
  }
}
