import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createLookup, isLookupKey, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ table: string }> };

/** POST /api/admin/lookups/[table] — adds a value to a lookup table. */
export async function POST(request: Request, { params }: Params) {
  const { table } = await params;

  let session;
  try {
    session = await requireRole("admin");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  if (!isLookupKey(table)) {
    return NextResponse.json(
      { error: "Unknown category." },
      { status: 404 },
    );
  }
  const key = table;

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
      ? (body as { name: string }).name.trim()
      : "";
  if (!name) {
    return NextResponse.json(
      { error: "A value is required." },
      { status: 400 },
    );
  }

  try {
    await createLookup(key, name);
    await writeAudit({
      actorUserId: session.userId,
      action: "CREATE_CATEGORY",
      entity: key,
      entityId: null,
      after: { name },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (raw.includes("unique") || raw.includes("duplicate")) {
      return NextResponse.json(
        { error: "That value already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not add the value." },
      { status: 500 },
    );
  }
}
