import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { promoteSchoolYearToCurrent, writeAudit } from "@/lib/queries";

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
  const result = await promoteSchoolYearToCurrent(id);
  if (!result) {
    return NextResponse.json(
      { error: "School year not found." },
      { status: 404 },
    );
  }
  await writeAudit({
    actorUserId: session.userId,
    action: "PROMOTE_SCHOOL_YEAR",
    entity: "school_years",
    entityId: id,
    after: result,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  return NextResponse.json({ ok: true, ...result });
}
