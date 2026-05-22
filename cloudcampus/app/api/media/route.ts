import { NextResponse } from "next/server";

import { presignedDownloadUrl, s3Configured } from "@/lib/s3";

/**
 * GET /api/media?key=<s3 key> — redirects to a short-lived pre-signed URL for
 * a cover or attachment image. The key is restricted to the covers/ and
 * attachments/ prefixes, so the route cannot be used to read arbitrary
 * objects (e.g. private resources or profile photos).
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";

  if (!key.startsWith("covers/") && !key.startsWith("attachments/")) {
    return NextResponse.json(
      { error: "Unsupported media key." },
      { status: 400 },
    );
  }
  if (!s3Configured) {
    return new NextResponse(null, { status: 404 });
  }

  const url = await presignedDownloadUrl(key);
  return NextResponse.redirect(url);
}
