import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarPlus,
  Clock,
  Clock3,
  ExternalLink,
  MapPin,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { BackLink } from "@/components/cloudcampus/back-link";
import { PlaceholderImage } from "@/components/cloudcampus/placeholder-image";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { formatDateLong, formatTime, isPast } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { getEvent } from "@/lib/queries";
import type { OrgEvent } from "@/lib/types";

type Params = { params: Promise<{ slug: string }> };

/** Builds a Google Calendar "add event" link (FR-EVT-04). */
function googleCalendarUrl(event: OrgEvent): string {
  const stamp = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`,
    details: event.summary,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  return {
    title: event ? event.title : "Event",
    description: event?.summary,
  };
}

export default async function EventDetailPage({ params }: Params) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const session = await getSession();
  const publicView =
    event.status === "approved" && event.visibility === "public";
  if (session.role === "guest" && !publicView) return <AccessDenied />;

  const past = isPast(event.startsAt);

  return (
    <div className="space-y-6">
      <BackLink href="/events" label="Events" />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-8">
          {event.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={event.coverUrl}
              alt={event.coverAlt}
              loading="lazy"
              className="aspect-video w-full rounded-xl object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <PlaceholderImage
              alt={event.coverAlt}
              aspect="aspect-video"
              className="rounded-xl ring-1 ring-foreground/10"
            />
          )}

          {event.status === "pending" && (
            <Alert variant="warning">
              <Clock />
              <AlertTitle>Pending approval</AlertTitle>
              <AlertDescription>
                This event is awaiting officer approval and is not yet public.
              </AlertDescription>
            </Alert>
          )}
          {event.status === "cancelled" && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>This event was cancelled</AlertTitle>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={past ? "outline" : "success"}>
              {past ? "Past" : "Upcoming"}
            </Badge>
            {event.visibility === "private" && (
              <Badge variant="outline">Private</Badge>
            )}
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-[-0.02em] md:text-4xl">
            {event.title}
          </h1>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">About this event</h2>
            <div className="max-w-prose space-y-3 leading-relaxed text-foreground/90">
              <p className="text-muted-foreground">{event.summary}</p>
              {event.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-4 rounded-xl bg-muted/40 p-5 ring-1 ring-foreground/10">
            <div className="space-y-2">
              <p className="font-medium">{formatDateLong(event.startsAt)}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
              </p>
            </div>
            {!past && event.status === "approved" && (
              <Button asChild variant="outline" className="w-full">
                <a
                  href={googleCalendarUrl(event)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <CalendarPlus /> Add to Google Calendar
                </a>
              </Button>
            )}
          </div>

          <div className="space-y-3 rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{event.location}</p>
                {event.locationNote && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.locationNote}
                  </p>
                )}
              </div>
            </div>
            {event.locationUrl && (
              <Button asChild variant="secondary" className="w-full">
                <a href={event.locationUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open map
                </a>
              </Button>
            )}
          </div>

          {event.createdByName && (
            <div className="flex items-center gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
              <UserAvatar name={event.createdByName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Organized by</p>
                <p className="truncate text-sm font-medium">
                  {event.createdByName}
                </p>
                {event.createdByPosition && (
                  <Badge variant="outline" className="mt-1">
                    {event.createdByPosition}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
