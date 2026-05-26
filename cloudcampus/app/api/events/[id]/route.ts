import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { EditNotAllowedError, updateEvent } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/**
 * PATCH /api/events/[id] — the creator (or an admin) edits an event. Sets
 * status to 'pending' and wipes existing votes so approvers re-vote from
 * scratch (V2.1 §1.3 + §0.2). Rejected events cannot be edited.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
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
  const data = body as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const startsAt = typeof data.startsAt === "string" ? data.startsAt : "";
  const endsAt = typeof data.endsAt === "string" ? data.endsAt : "";
  const visibility = data.visibility === "private" ? "private" : "public";

  if (!title || !description || !startsAt || !endsAt) {
    return NextResponse.json(
      { error: "Title, description, start, and end are required." },
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
    await updateEvent({
      id,
      memberId: session.memberId,
      isAdmin: session.role === "admin",
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EditNotAllowedError) {
      const status =
        err.reason === "not_found"
          ? 404
          : err.reason === "rejected"
            ? 409
            : 403;
      const message =
        err.reason === "not_found"
          ? "Event not found."
          : err.reason === "rejected"
            ? "Rejected events cannot be edited. Please submit a new draft."
            : "You can only edit events you created.";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Could not save the event. Please try again." },
      { status: 500 },
    );
  }
}
