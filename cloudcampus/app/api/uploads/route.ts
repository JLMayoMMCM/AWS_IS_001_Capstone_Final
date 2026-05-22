import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import {
  buildObjectKey,
  deleteObject,
  isOwnedKey,
  presignedUploadUrl,
  s3Configured,
  type UploadPurpose,
} from "@/lib/s3";

// /api/uploads — direct-to-S3 upload support (FEAS §3.2).
//
//   POST   mints a short-lived pre-signed PUT URL; the browser uploads the
//          file straight to S3, then submits the returned key with the
//          relevant create/update request.
//   DELETE removes a superseded object — used when the picker replaces a file
//          that was uploaded but not yet saved, so abandoned uploads do not
//          accumulate as orphans in the bucket.

/** Resource uploads are admin-only; profile photos need any signed-in member. */
function roleFor(purpose: UploadPurpose): "admin" | "member" {
  return purpose === "resource" ? "admin" : "member";
}

function purposeOf(value: unknown): UploadPurpose | null {
  return value === "resource" ||
    value === "photo" ||
    value === "cover" ||
    value === "attachment"
    ? value
    : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const data = body as {
    purpose?: unknown;
    fileName?: unknown;
    contentType?: unknown;
  };
  const purpose = purposeOf(data.purpose);
  const fileName = typeof data.fileName === "string" ? data.fileName : "";
  const contentType =
    typeof data.contentType === "string" && data.contentType
      ? data.contentType
      : "application/octet-stream";

  if (!purpose || !fileName) {
    return NextResponse.json(
      { error: "purpose and fileName are required." },
      { status: 400 },
    );
  }

  let session;
  try {
    session = await requireRole(roleFor(purpose));
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  if (!s3Configured) {
    return NextResponse.json(
      { error: "File storage is not configured." },
      { status: 503 },
    );
  }

  const key = buildObjectKey(purpose, fileName, session.memberId);
  const uploadUrl = await presignedUploadUrl(key, contentType);
  return NextResponse.json({ uploadUrl, key });
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const data = body as { purpose?: unknown; key?: unknown };
  const purpose = purposeOf(data.purpose);
  const key = typeof data.key === "string" ? data.key : "";

  if (!purpose || !key) {
    return NextResponse.json(
      { error: "purpose and key are required." },
      { status: 400 },
    );
  }

  let session;
  try {
    session = await requireRole(roleFor(purpose));
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  // Only let a caller remove objects inside its own namespace.
  if (!isOwnedKey(purpose, key, session.memberId)) {
    return NextResponse.json(
      { error: "That object cannot be removed." },
      { status: 403 },
    );
  }

  if (s3Configured) {
    try {
      await deleteObject(key);
    } catch {
      // Best-effort cleanup — a missing object is not an error worth failing.
    }
  }
  return NextResponse.json({ ok: true });
}
