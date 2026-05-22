import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createProject, parseAttachments } from "@/lib/queries";

/** Splits a comma-separated field into a clean list. */
function parseList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Optional trimmed URL-ish string, or null when blank. */
function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/** POST /api/projects — a member submits a project for review (FR-MEM-07). */
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
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const visibility = data.visibility === "private" ? "private" : "public";

  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json(
      { error: "A short description is required." },
      { status: 400 },
    );
  }

  try {
    const id = await createProject({
      submittedBy: session.memberId,
      title,
      description,
      bodyMarkdown: optionalText(data.bodyMarkdown),
      repoUrl: optionalText(data.repoUrl),
      liveUrl: optionalText(data.liveUrl),
      techStack: parseList(data.techStack),
      tags: parseList(data.tags),
      visibility,
      categoryId:
        typeof data.categoryId === "string" && data.categoryId
          ? data.categoryId
          : null,
      coverS3Key:
        typeof data.coverKey === "string" && data.coverKey
          ? data.coverKey
          : null,
      attachments: parseAttachments(data.attachments),
    });
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json(
      { error: "Could not save the project. Please try again." },
      { status: 500 },
    );
  }
}
