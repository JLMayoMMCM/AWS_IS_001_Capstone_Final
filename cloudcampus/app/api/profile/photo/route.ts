import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { getMemberPhotoKey, updateMemberPhoto } from "@/lib/queries";
import { deleteObject, s3Configured } from "@/lib/s3";

/**
 * POST /api/profile/photo — sets the signed-in member's profile photo to a
 * file already uploaded via /api/uploads (FR-MEM-04).
 */
export async function POST(request: Request) {
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

  const key = (body as { key?: unknown }).key;
  // The upload route namespaces photo keys under members/<memberId>/ — verify
  // the key belongs to this member so one member cannot claim another's file.
  if (typeof key !== "string" || !key.startsWith(`members/${session.memberId}/`)) {
    return NextResponse.json(
      { error: "Invalid photo reference." },
      { status: 400 },
    );
  }

  // Swap the photo, then drop the file it replaced so old avatars do not
  // linger in the bucket (best-effort — a stale object is not worth failing).
  const previousKey = await getMemberPhotoKey(session.memberId);
  await updateMemberPhoto(session.memberId, key);
  if (previousKey && previousKey !== key && s3Configured) {
    try {
      await deleteObject(previousKey);
    } catch {
      // Orphaned object — acceptable; the member's photo is already updated.
    }
  }
  return NextResponse.json({ ok: true });
}
