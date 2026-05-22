import { NextResponse } from "next/server";

import { getMemberPhotoKey } from "@/lib/queries";
import { presignedDownloadUrl, s3Configured } from "@/lib/s3";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/members/[id]/photo — redirects to a pre-signed URL for the member's
 * profile photo, or 404s if they have none (the Avatar then shows initials).
 * Photos are not sensitive; this route is open so avatars render for everyone.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const key = await getMemberPhotoKey(id);
  if (!key || !s3Configured) {
    return new NextResponse(null, { status: 404 });
  }

  const url = await presignedDownloadUrl(key);
  return NextResponse.redirect(url);
}
