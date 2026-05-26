import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { createSchoolYear, writeAudit } from "@/lib/queries";

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
  const startYear = (body as { startYear?: unknown }).startYear;
  if (
    typeof startYear !== "number" ||
    !Number.isInteger(startYear) ||
    startYear < 1900 ||
    startYear > 2200
  ) {
    return NextResponse.json(
      { error: "startYear must be an integer." },
      { status: 400 },
    );
  }
  try {
    const id = await createSchoolYear(startYear);
    await writeAudit({
      actorUserId: session.userId,
      action: "CREATE_SCHOOL_YEAR",
      entity: "school_years",
      entityId: id,
      after: { startYear, endYear: startYear + 1 },
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("unique")
        ? "That school year already exists."
        : "Could not create the school year.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
