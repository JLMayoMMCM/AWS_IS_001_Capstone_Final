import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { BackLink } from "@/components/cloudcampus/back-link";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { EventForm } from "./event-form";

export const metadata: Metadata = {
  title: "Create an event",
};

export default async function NewEventPage() {
  const session = await getSession();
  if (session.role === "guest") return <AccessDenied />;

  // Members can browse here but only officers may create events (FR-OFF-02).
  if (session.role === "member") {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Officers only"
        body="Creating events is limited to current officers."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/events" label="Events" />
      <PageHeader
        title="Create an event"
        subtitle="Your event is sent to the three approver positions for review."
      />
      <EventForm />
    </div>
  );
}
