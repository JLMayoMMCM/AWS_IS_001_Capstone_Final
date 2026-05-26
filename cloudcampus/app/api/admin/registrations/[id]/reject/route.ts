import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { sendRegistrationDecisionEmail } from "@/lib/email";
import { rejectRegistration, writeAudit } from "@/lib/queries";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  let session;
  try {
    session = await requireRole("admin");
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
  const note =
    typeof (body as { note?: unknown }).note === "string"
      ? (body as { note: string }).note.trim()
      : "";
  if (!note) {
    return NextResponse.json(
      { error: "A rejection note is required." },
      { status: 400 },
    );
  }

  try {
    const result = await rejectRegistration(id, session.userId, note);
    if (!result) {
      return NextResponse.json(
        { error: "Request not found or already reviewed." },
        { status: 404 },
      );
    }

    await writeAudit({
      actorUserId: session.userId,
      action: "REJECT_REGISTRATION",
      entity: "registration_requests",
      entityId: id,
      after: { email: result.email, note },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    void sendRegistrationDecisionEmail({
      to: result.email,
      name: result.name,
      approved: false,
      note,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reject-registration]", err);
    return NextResponse.json(
      { error: "Could not reject the registration." },
      { status: 500 },
    );
  }
}
