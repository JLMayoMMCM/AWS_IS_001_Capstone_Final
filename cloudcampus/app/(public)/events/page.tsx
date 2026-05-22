import type { Metadata } from "next";

import { getSession } from "@/lib/auth";
import { listEvents } from "@/lib/queries";
import { EventsView } from "./events-view";

export const metadata: Metadata = {
  title: "Events",
  description: "Workshops, panels, hackathons, and socials at CloudCampus.",
};

export default async function EventsPage() {
  const session = await getSession();
  const events = await listEvents(session.role !== "guest");
  return <EventsView events={events} />;
}
