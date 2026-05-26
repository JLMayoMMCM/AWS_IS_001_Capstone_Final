import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { updateMemberProfile } from "@/lib/queries";

/** Optional trimmed string, or null when blank. */
function optionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

/** PATCH /api/profile — a member updates their own profile (FR-MEM-04/05). */
export async function PATCH(request: Request) {
  let session;
  try {
    session = await requireRole("member");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId) {
    return NextResponse.json(
      { error: "No member profile is linked to this account." },
      { status: 400 },
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
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Full name is required." },
      { status: 400 },
    );
  }

  let year: number | null = null;
  if (typeof data.year === "number" && data.year >= 1 && data.year <= 5) {
    year = Math.trunc(data.year);
  }

  // A member can only edit their own row — the id comes from the session.
  await updateMemberProfile(session.memberId, {
    name,
    courseId: optionalText(data.courseId),
    course: optionalText(data.course),
    year,
    bio: optionalText(data.bio),
    contactEmail: optionalText(data.contactEmail),
  });

  return NextResponse.json({ ok: true });
}
