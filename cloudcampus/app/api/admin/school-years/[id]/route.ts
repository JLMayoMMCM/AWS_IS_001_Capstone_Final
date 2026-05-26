import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { deleteSchoolYear, writeAudit } from "@/lib/queries";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
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
  const label = await deleteSchoolYear(id);
  if (!label) {
    return NextResponse.json(
      {
        error:
          "Cannot delete this school year — it is the current year or has officers assigned.",
      },
      { status: 409 },
    );
  }
  await writeAudit({
    actorUserId: session.userId,
    action: "DELETE_SCHOOL_YEAR",
    entity: "school_years",
    entityId: id,
    before: { label },
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return NextResponse.json({ ok: true });
}
