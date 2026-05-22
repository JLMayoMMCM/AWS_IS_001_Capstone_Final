import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { deleteForm, updateForm, writeAudit } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admin/forms/[id] — edits a form link (FR-ADM-09). */
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
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!title || !url) {
    return NextResponse.json(
      { error: "A title and form URL are required." },
      { status: 400 },
    );
  }

  const updated = await updateForm(id, {
    title,
    description:
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : null,
    provider: data.provider === "microsoft" ? "microsoft" : "google",
    url,
    embedHtml:
      typeof data.embedHtml === "string" && data.embedHtml.trim()
        ? data.embedHtml.trim()
        : null,
    visibility: data.visibility === "private" ? "private" : "public",
  });
  if (!updated) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: "UPDATE_FORM",
    entity: "form_links",
    entityId: id,
    after: { title },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/forms/[id] — removes a form link (FR-ADM-09). */
export async function DELETE(request: Request, { params }: Params) {
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

  const title = await deleteForm(id);
  if (!title) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  await writeAudit({
    actorUserId: session.userId,
    action: "DELETE_FORM",
    entity: "form_links",
    entityId: null,
    after: { title },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return NextResponse.json({ ok: true });
}
