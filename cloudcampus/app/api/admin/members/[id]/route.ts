import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { adminUpdateMember, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/** Optional trimmed string, or null when blank. */
function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/** PATCH /api/admin/members/[id] — edits a member's directory record (FR-ADM-02). */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

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
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "A full name is required." },
      { status: 400 },
    );
  }

  const yearRaw = data.year;
  const year =
    typeof yearRaw === "number" && yearRaw >= 1 && yearRaw <= 5
      ? Math.trunc(yearRaw)
      : null;
  // A member_statuses lookup name; defaults to "Active" for anything else.
  const MEMBER_STATUSES = ["Active", "For Renewal", "Inactive", "Alumni"];
  const status =
    typeof data.status === "string" && MEMBER_STATUSES.includes(data.status)
      ? data.status
      : "Active";

  try {
    const updated = await adminUpdateMember(id, {
      name,
      studentId: optionalText(data.studentId),
      course: optionalText(data.course),
      year,
      bio: optionalText(data.bio),
      contactEmail: optionalText(data.contactEmail),
      status,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Member not found." },
        { status: 404 },
      );
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "UPDATE_MEMBER",
      entity: "members",
      entityId: id,
      after: { name, status },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("unique") || raw.includes("duplicate")) {
      return NextResponse.json(
        { error: "That student ID is already in use." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not update the member." },
      { status: 500 },
    );
  }
}
