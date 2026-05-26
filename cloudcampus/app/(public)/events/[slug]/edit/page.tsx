import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { getEvent } from "@/lib/queries";
import { EventForm } from "../../new/event-form";

export const metadata: Metadata = { title: "Edit event" };

type Props = { params: Promise<{ slug: string }> };

/**
 * /events/[slug]/edit — the creator (or an admin) re-opens an event.
 * Saving clears existing votes and returns the event to the approval
 * queue (V2.1 §1.2 + §0.2). Rejected events are not editable.
 */
export default async function EditEventPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  if (session.role === "guest" || !session.memberId) return <AccessDenied />;
  const event = await getEvent(slug);
  if (!event) notFound();

  const isCreator = event.createdBy === session.memberId;
  if (!isCreator && session.role !== "admin") return <AccessDenied />;
  if (event.status === "rejected") redirect(`/events/${slug}`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Edit: ${event.title}`}
        subtitle="Saving returns this event to the approval queue."
      />
      <EventForm existing={event} />
    </div>
  );
}
