import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createAnnouncement, writeAudit } from "@/lib/queries";
import type {
  AnnouncementAudience,
  AnnouncementLevel,
} from "@/lib/types";

const LEVELS: AnnouncementLevel[] = ["normal", "elevated", "critical"];
const AUDIENCES: AnnouncementAudience[] = ["public", "members", "officers"];

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** POST /api/admin/announcements — officers+ post a new announcement. */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireRole("officer");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.userId || !session.memberId) {
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
  const bodyMarkdown =
    typeof data.bodyMarkdown === "string" ? data.bodyMarkdown.trim() : "";
  const level = LEVELS.includes(data.level as AnnouncementLevel)
    ? (data.level as AnnouncementLevel)
    : "normal";
  const audience = AUDIENCES.includes(data.audience as AnnouncementAudience)
    ? (data.audience as AnnouncementAudience)
    : "members";
  if (!title || !bodyMarkdown) {
    return NextResponse.json(
      { error: "A title and body are required." },
      { status: 400 },
    );
  }

  try {
    const id = await createAnnouncement({
      authorId: session.memberId,
      title,
      bodyMarkdown,
      level,
      audience,
      publishedAt: parseDate(data.publishedAt),
      expiresAt: parseDate(data.expiresAt),
      pinnedUntil: parseDate(data.pinnedUntil),
    });

    await writeAudit({
      actorUserId: session.userId,
      action: "CREATE_ANNOUNCEMENT",
      entity: "announcements",
      entityId: id,
      after: { title, level, audience },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[create-announcement]", err);
    return NextResponse.json(
      { error: "Could not post the announcement." },
      { status: 500 },
    );
  }
}
