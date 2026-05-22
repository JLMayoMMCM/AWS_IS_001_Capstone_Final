import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getResource } from "@/lib/queries";
import { presignedDownloadUrl, s3Configured } from "@/lib/s3";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/resources/[id]/download — redirects to a short-lived pre-signed S3
 * URL (FR-RES-03). Private resources require a session (FR-PUB-10). The file
 * is served straight from S3 — it never proxies through the app.
 *
 * `?download=1` forces an attachment download; without it the object is served
 * inline so PDFs and images can be previewed in the page.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const wantsDownload =
    new URL(request.url).searchParams.get("download") === "1";

  const resource = await getResource(id);
  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const session = await getSession();
  if (resource.visibility === "private" && session.role === "guest") {
    return NextResponse.json(
      { error: "This resource is available to members only." },
      { status: 403 },
    );
  }

  if (!s3Configured) {
    return NextResponse.json(
      { error: "File storage is not configured." },
      { status: 503 },
    );
  }

  const url = await presignedDownloadUrl(
    resource.s3Key,
    wantsDownload ? resource.fileName : undefined,
  );
  return NextResponse.redirect(url);
}
