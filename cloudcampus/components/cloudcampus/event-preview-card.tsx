import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";

import { PlaceholderImage } from "@/components/cloudcampus/placeholder-image";
import type { OrgEvent } from "@/lib/types";

/**
 * Cover-image event card used on the welcome page's "Upcoming events" grid
 * (WIRE §5.1). The events-list page uses the denser row card instead.
 *
 * Uses a plain card surface (not shadcn `Card`) so the cover image can sit
 * flush to the top edge — the radix-maia `Card` bakes in vertical padding.
 */
export function EventPreviewCard({ event }: { event: OrgEvent }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {event.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverUrl}
          alt={event.coverAlt}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <PlaceholderImage alt={event.coverAlt} aspect="aspect-video" />
      )}
      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-1 text-xl font-semibold leading-tight">
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
    </Link>
  );
}
