import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createForm, writeAudit } from "@/lib/queries";

/** POST /api/admin/forms — publishes a new form link (FR-ADM-09). */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireRole("admin");
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
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const provider = data.provider === "microsoft" ? "microsoft" : "google";
  const description =
    typeof data.description === "string" && data.description.trim()
      ? data.description.trim()
      : null;
  const embedHtml =
    typeof data.embedHtml === "string" && data.embedHtml.trim()
      ? data.embedHtml.trim()
      : null;
  const visibility = data.visibility === "private" ? "private" : "public";

  if (!title || !url) {
    return NextResponse.json(
      { error: "A title and form URL are required." },
      { status: 400 },
    );
  }

  try {
    const id = await createForm({
      title,
      description,
      provider,
      url,
      embedHtml,
      visibility,
      createdBy: session.memberId,
    });
    await writeAudit({
      actorUserId: session.userId,
      action: "CREATE_FORM",
      entity: "form_links",
      entityId: id,
      after: { title, provider, visibility },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json(
      { error: "Could not publish the form." },
      { status: 500 },
    );
  }
}
