import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { listEvents } from "@/lib/queries";
import { EventsAdminView } from "./events-admin-view";

export const metadata: Metadata = { title: "Events" };

export default async function AdminEventsPage() {
  const events = await listEvents(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Override the approval workflow — officers create events on the public side."
      />
      <EventsAdminView events={events} />
    </div>
  );
}
