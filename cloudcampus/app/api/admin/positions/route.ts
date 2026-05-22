import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createPosition, writeAudit } from "@/lib/queries";

/** POST /api/admin/positions — adds an officer position (FR-ADM-05). */
export async function POST(request: Request) {
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

  const name =
    typeof (body as { name?: unknown }).name === "string"
      ? ((body as { name: string }).name).trim()
      : "";
  if (!name) {
    return NextResponse.json(
      { error: "A position name is required." },
      { status: 400 },
    );
  }

  try {
    const created = await createPosition(name);
    await writeAudit({
      actorUserId: session.userId,
      action: "CREATE_POSITION",
      entity: "officer_positions",
      entityId: created?.id ?? null,
      after: { name },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("unique") || raw.includes("duplicate")) {
      return NextResponse.json(
        { error: "A position with that name already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not add the position." },
      { status: 500 },
    );
  }
}
