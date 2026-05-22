import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import {
  deleteResource,
  replaceResourceFile,
  updateResource,
  writeAudit,
} from "@/lib/queries";
import { deleteObject, s3Configured } from "@/lib/s3";

type Params = { params: Promise<{ id: string }> };

/** Optional trimmed string, or null when blank. */
function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/**
 * PATCH /api/admin/resources/[id] — edits a resource (FR-ADM-10). A request
 * carrying a `key` swaps the backing file; otherwise it renames/edits the
 * metadata. The previous file is removed from S3 on a successful swap.
 */
export async function PATCH(request: Request, { params }: Params) {
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

  const data = body as Record<string, unknown>;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // A `key` means the admin uploaded a replacement file.
  if (typeof data.key === "string" && data.key) {
    const fileName = typeof data.fileName === "string" ? data.fileName : "";
    if (!fileName) {
      return NextResponse.json(
        { error: "The replacement file is incomplete." },
        { status: 400 },
      );
    }
    const swapped = await replaceResourceFile(id, {
      s3Key: data.key,
      fileName,
      mimeType:
        typeof data.mimeType === "string" && data.mimeType
          ? data.mimeType
          : "application/octet-stream",
      sizeBytes: typeof data.size === "number" ? Math.trunc(data.size) : 0,
    });
    if (!swapped) {
      return NextResponse.json(
        { error: "Resource not found." },
        { status: 404 },
      );
    }
    if (s3Configured && swapped.oldS3Key !== data.key) {
      try {
        await deleteObject(swapped.oldS3Key);
      } catch {
        // Orphaned object — acceptable; the resource already points at the new file.
      }
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "REPLACE_RESOURCE_FILE",
      entity: "resources",
      entityId: id,
      after: { title: swapped.title, fileName },
      ip,
    });
    return NextResponse.json({ ok: true });
  }

  // Otherwise it is a metadata edit (rename).
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  const updated = await updateResource(id, {
    title,
    description: optionalText(data.description),
    categoryName: optionalText(data.category),
    visibility: data.visibility === "private" ? "private" : "public",
  });
  if (!updated) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }
  await writeAudit({
    actorUserId: session.userId,
    action: "UPDATE_RESOURCE",
    entity: "resources",
    entityId: id,
    after: { title },
    ip,
  });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/resources/[id] — remove a resource (FR-ADM-10): the
 * metadata row and the backing file in S3 both go.
 */
export async function DELETE(request: Request, { params }: Params) {
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

  const deleted = await deleteResource(id);
  if (!deleted) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  // Remove the file from S3 too. Best-effort: the row is already gone, so a
  // bucket error here must not fail the request and leave a dangling row.
  if (s3Configured) {
    try {
      await deleteObject(deleted.s3Key);
    } catch {
      // Orphaned object — acceptable; the metadata row is what users see.
    }
  }

  await writeAudit({
    actorUserId: session.userId,
    action: "DELETE_RESOURCE",
    entity: "resources",
    entityId: null,
    after: { title: deleted.title },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
