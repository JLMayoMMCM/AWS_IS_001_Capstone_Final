import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import {
  deleteLookup,
  isLookupKey,
  updateLookup,
  writeAudit,
} from "@/lib/queries";

type Params = { params: Promise<{ table: string; id: string }> };

/** PATCH /api/admin/lookups/[table]/[id] — renames a lookup value. */
export async function PATCH(request: Request, { params }: Params) {
  const { table, id } = await params;

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
    const ok = await updateLookup(key, id, name);
    if (!ok) {
      return NextResponse.json(
        { error: "Value not found." },
        { status: 404 },
      );
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "UPDATE_CATEGORY",
      entity: key,
      entityId: id,
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
      { error: "Could not save the value." },
      { status: 500 },
    );
  }
}

/** DELETE /api/admin/lookups/[table]/[id] — removes a lookup value. */
export async function DELETE(request: Request, { params }: Params) {
  const { table, id } = await params;

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

  try {
    const ok = await deleteLookup(key, id);
    if (!ok) {
      return NextResponse.json(
        { error: "Value not found." },
        { status: 404 },
      );
    }
    await writeAudit({
      actorUserId: session.userId,
      action: "DELETE_CATEGORY",
      entity: key,
      entityId: id,
      after: { id },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (
      raw.includes("foreign key") ||
      raw.includes("violates") ||
      raw.includes("exactly 3")
    ) {
      return NextResponse.json(
        { error: "This value is still in use and cannot be removed." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not delete the value." },
      { status: 500 },
    );
  }
}
