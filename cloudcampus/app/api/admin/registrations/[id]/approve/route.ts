import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { sendRegistrationDecisionEmail } from "@/lib/email";
import { approveRegistration, writeAudit } from "@/lib/queries";

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

  try {
    const result = await approveRegistration(id, session.userId);
    if (!result) {
      return NextResponse.json(
        { error: "Request not found or already reviewed." },
        { status: 404 },
      );
    }

    await writeAudit({
      actorUserId: session.userId,
      action: "APPROVE_REGISTRATION",
      entity: "registration_requests",
      entityId: id,
      after: { memberId: result.memberId, email: result.email },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    // Fire-and-forget email; failures don't block the approval.
    void sendRegistrationDecisionEmail({
      to: result.email,
      name: result.name,
      approved: true,
      note: null,
    });

    return NextResponse.json({ ok: true, memberId: result.memberId });
  } catch (err) {
    console.error("[approve-registration]", err);
    return NextResponse.json(
      { error: "Could not approve the registration." },
      { status: 500 },
    );
  }
}
