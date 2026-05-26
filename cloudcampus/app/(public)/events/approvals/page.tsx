import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { BackLink } from "@/components/cloudcampus/back-link";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { getCurrentOfficer, listPendingEvents } from "@/lib/queries";
import { ApprovalQueue } from "./approval-queue";

export const metadata: Metadata = {
  title: "Event approvals",
};

export default async function EventApprovalsPage() {
  const session = await getSession();
  if (session.role === "guest" || !session.memberId) {
    return <AccessDenied />;
  }

  const officer = await getCurrentOfficer(session.memberId);

  // Only officers holding an approver position may vote (FR-OFF-04).
  if (!officer || !officer.isApprover) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Approvers only"
        body="This queue is for officers holding one of the three approver positions."
      />
    );
  }

  const events = await listPendingEvents();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/events" label="Events" />
      <PageHeader
        title="Event approvals"
        subtitle={`You vote as ${officer.positionName}. An event is published once every approver votes to approve; any single rejection rejects it.`}
      />
      <ApprovalQueue
        events={events}
        currentMemberId={session.memberId}
        myPositionId={officer.positionId}
      />
    </div>
  );
}
