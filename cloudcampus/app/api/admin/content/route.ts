import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { updateOrg, writeAudit } from "@/lib/queries";

/** Trimmed string, or "" when not a string. */
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * PATCH /api/admin/content — edits the organization profile shown across the
 * site (FR-ADM-08). `about` may be an array of paragraphs or a single
 * blank-line-separated string.
 */
export async function PATCH(request: Request) {
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
  const name = str(data.name);
  const tagline = str(data.tagline);
  if (!name || !tagline) {
    return NextResponse.json(
      { error: "An organization name and tagline are required." },
      { status: 400 },
    );
  }

  const about = Array.isArray(data.about)
    ? data.about
        .filter((p): p is string => typeof p === "string" && p.trim() !== "")
        .map((p) => p.trim())
    : str(data.about)
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

  try {
    await updateOrg({
      name,
      shortName: str(data.shortName) || name,
      tagline,
      term: str(data.term),
      about,
      contact: {
        email: str(data.contactEmail),
        address: str(data.contactAddress),
        hours: str(data.contactHours),
      },
    });
    await writeAudit({
      actorUserId: session.userId,
      action: "UPDATE_SITE_CONTENT",
      entity: "site_settings",
      entityId: null,
      after: { name, tagline },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not save the content." },
      { status: 500 },
    );
  }
}
