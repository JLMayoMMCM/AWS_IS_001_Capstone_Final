import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createResource, writeAudit } from "@/lib/queries";

/** Optional trimmed string, or null when blank. */
function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/**
 * POST /api/admin/resources — creates a resource row after its file has been
 * uploaded to S3 via /api/uploads (FR-ADM-10).
 */
export async function POST(request: Request) {
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

  const data = body as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const key = typeof data.key === "string" ? data.key : "";
  const fileName = typeof data.fileName === "string" ? data.fileName : "";
  const mimeType =
    typeof data.mimeType === "string" && data.mimeType
      ? data.mimeType
      : "application/octet-stream";
  const size = typeof data.size === "number" ? Math.trunc(data.size) : 0;
  const visibility = data.visibility === "private" ? "private" : "public";

  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  if (!key || !fileName) {
    return NextResponse.json(
      { error: "Upload a file before saving." },
      { status: 400 },
    );
  }

  try {
    const id = await createResource({
      title,
      description: optionalText(data.description),
      categoryName: optionalText(data.category),
      s3Key: key,
      fileName,
      mimeType,
      sizeBytes: size,
      visibility,
      uploadedBy: session.memberId,
    });

    await writeAudit({
      actorUserId: session.userId,
      action: "UPLOAD_RESOURCE",
      entity: "resources",
      entityId: id,
      after: { title, visibility },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json(
      { error: "Could not save the resource." },
      { status: 500 },
    );
  }
}
