import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import {
  deleteAnnouncement,
  updateAnnouncement,
  writeAudit,
} from "@/lib/queries";
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  let session;
  try {
    session = await requireRole("officer");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }
  const { id } = await context.params;
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
    const result = await updateAnnouncement(id, {
      title,
      bodyMarkdown,
      level,
      audience,
      publishedAt: parseDate(data.publishedAt),
      expiresAt: parseDate(data.expiresAt),
      pinnedUntil: parseDate(data.pinnedUntil),
    });
    if (!result) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "UPDATE_ANNOUNCEMENT",
      entity: "announcements",
      entityId: id,
      after: { title, level, audience },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[update-announcement]", err);
    return NextResponse.json(
      { error: "Could not update the announcement." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let session;
  try {
    session = await requireRole("officer");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }
  const { id } = await context.params;
  try {
    const title = await deleteAnnouncement(id);
    if (!title) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "DELETE_ANNOUNCEMENT",
      entity: "announcements",
      entityId: id,
      before: { title },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[delete-announcement]", err);
    return NextResponse.json(
      { error: "Could not delete the announcement." },
      { status: 500 },
    );
  }
}
