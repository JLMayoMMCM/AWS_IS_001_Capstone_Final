import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/lib/auth";
import { castProjectVote, getCurrentOfficer } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/approvals — an approver officer votes on a project
 * (V2.1 extension). Mirrors the event-voting flow; the project_approvals
 * triggers enforce the validation + unanimous status advance (any single
 * reject vote rejects the project).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  let session;
  try {
    session = await requireRole("officer");
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!session.memberId) {
    return NextResponse.json(
      { error: "No member profile is linked to this account." },
      { status: 400 },
    );
  }

  const officer = await getCurrentOfficer(session.memberId);
  if (!officer || !officer.isApprover) {
    return NextResponse.json(
      { error: "Only officers in an approver position can vote." },
      { status: 403 },
    );
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
  const decision =
    data.decision === "approved" ||
    data.decision === "rejected" ||
    data.decision === "revision_requested"
      ? data.decision
      : null;
  if (!decision) {
    return NextResponse.json(
      {
        error:
          "A decision of 'approved', 'rejected', or 'revision_requested' is required.",
      },
      { status: 400 },
    );
  }

  const comment =
    typeof data.comment === "string" ? data.comment.trim() : "";
  if (
    (decision === "rejected" || decision === "revision_requested") &&
    !comment
  ) {
    return NextResponse.json(
      { error: `A ${decision} decision requires a comment.` },
      { status: 400 },
    );
  }

  try {
    await castProjectVote({
      projectId: id,
      positionId: officer.positionId,
      officerId: officer.officerId,
      decision,
      comment: comment || null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    let message = "Could not record your vote.";
    if (raw.includes("unique constraint")) {
      message = "Your position has already voted on this project.";
    } else if (raw.includes("vote on a project they submitted")) {
      message = "You cannot vote on a project you submitted.";
    } else if (raw.startsWith("a ") || raw.includes("officer")) {
      message = raw;
    }
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
