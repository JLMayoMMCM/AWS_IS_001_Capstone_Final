import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createEvent, getCurrentOfficer } from "@/lib/queries";

/** Optional trimmed string, or null when blank. */
function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/** POST /api/events — an officer creates an event for approval (FR-OFF-02). */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireRole("officer");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId) {
    return NextResponse.json(
      { error: "No member profile is linked to this account." },
      { status: 400 },
    );
  }

  // Confirm the caller currently holds an officer position.
  const officer = await getCurrentOfficer(session.memberId);
  if (!officer && session.role !== "admin") {
    return NextResponse.json(
      { error: "Only current officers can create events." },
      { status: 403 },
    );
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
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const startsAt = typeof data.startsAt === "string" ? data.startsAt : "";
  const endsAt = typeof data.endsAt === "string" ? data.endsAt : "";
  const visibility = data.visibility === "private" ? "private" : "public";

  if (!title || !description) {
    return NextResponse.json(
      { error: "A title and description are required." },
      { status: 400 },
    );
  }
  if (!startsAt || !endsAt) {
    return NextResponse.json(
      { error: "Start and end times are required." },
      { status: 400 },
    );
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json(
      { error: "The end time must be after the start time." },
      { status: 400 },
    );
  }

  try {
    const slug = await createEvent({
      createdBy: session.memberId,
      title,
      description,
      bodyMarkdown: optionalText(data.bodyMarkdown),
      location: optionalText(data.location),
      locationUrl: optionalText(data.locationUrl),
      startsAt,
      endsAt,
      visibility,
      coverS3Key:
        typeof data.coverKey === "string" && data.coverKey
          ? data.coverKey
          : null,
    });
    return NextResponse.json({ ok: true, slug });
  } catch {
    return NextResponse.json(
      { error: "Could not create the event. Please try again." },
      { status: 500 },
    );
  }
}
