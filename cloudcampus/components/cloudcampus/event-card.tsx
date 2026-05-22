import Link from "next/link";
import { Calendar, CalendarDays, Clock, Lock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { daysUntil } from "@/lib/format";
import type { OrgEvent } from "@/lib/types";

/**
 * Dense row card for the events list (WIRE §5.13): a cover thumbnail on the
 * left, then title, date, location, and status badges.
 */
export function EventCard({ event }: { event: OrgEvent }) {
  const due = daysUntil(event.startsAt);
  const soon = due > 0 && due <= 7;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex gap-3 rounded-xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:gap-4 md:p-4"
      aria-label={event.title}
    >
      {event.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverUrl}
          alt={event.coverAlt}
          loading="lazy"
          className="size-20 shrink-0 rounded-md object-cover md:h-32 md:w-48"
        />
      ) : (
        <div
          className="ph-stripes flex size-20 shrink-0 items-center justify-center rounded-md md:h-32 md:w-48"
          aria-hidden
        >
          <CalendarDays className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="space-y-1">
          <h3 className="line-clamp-1 text-base font-semibold leading-tight md:text-lg">
            {event.title}
          </h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1">{event.dateLabel}</span>
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {soon && (
            <Badge variant="secondary">
              <Clock /> In {due} day{due !== 1 ? "s" : ""}
            </Badge>
          )}
          {event.visibility === "private" && (
            <Badge variant="outline">
              <Lock /> Private
            </Badge>
          )}
          {event.status === "pending" && (
            <Badge variant="warning">
              <Clock /> Pending approval
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
