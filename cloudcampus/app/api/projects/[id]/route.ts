import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import {
  EditNotAllowedError,
  parseAttachments,
  updateProject,
} from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((s): s is string => typeof s === "string" && s.trim() !== "")
      .map((s) => s.trim());
  }
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * PATCH /api/projects/[id] — the submitter (or an admin) edits a project.
 * Sets status to 'pending'. Rejected projects cannot be edited. (V2.1 §1.3)
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
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const visibility = data.visibility === "private" ? "private" : "public";
  if (!title || !description) {
    return NextResponse.json(
      { error: "A title and short description are required." },
      { status: 400 },
    );
  }

  try {
    await updateProject({
      id,
      memberId: session.memberId,
      isAdmin: session.role === "admin",
      title,
      description,
      bodyMarkdown: optionalText(data.bodyMarkdown),
      repoUrl: optionalText(data.repoUrl),
      liveUrl: optionalText(data.liveUrl),
      publishedUrl: optionalText(data.publishedUrl),
      techStack: splitList(data.techStack),
      tags: splitList(data.tags),
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
          ? "Project not found."
          : err.reason === "rejected"
            ? "Rejected projects cannot be edited. Please submit a new draft."
            : "You can only edit your own projects.";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Could not save the project. Please try again." },
      { status: 500 },
    );
  }
}
