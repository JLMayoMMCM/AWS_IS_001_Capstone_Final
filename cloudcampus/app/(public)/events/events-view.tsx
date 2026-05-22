"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, Plus, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { EventCard } from "@/components/cloudcampus/event-card";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { useSession } from "@/components/cloudcampus/session-provider";
import { isPast } from "@/lib/format";
import type { OrgEvent } from "@/lib/types";

type Tab = "upcoming" | "past" | "all";
type Vis = "all" | "public" | "private";

export function EventsView({ events }: { events: OrgEvent[] }) {
  const { role } = useSession();
  const isGuest = role === "guest";
  const isOfficer = role === "officer" || role === "admin";

  const [tab, setTab] = useState<Tab>("upcoming");
  const [vis, setVis] = useState<Vis>("all");

  const items = useMemo(() => {
    let pool = events;
    if (!isGuest && vis !== "all") {
      pool = pool.filter((e) => e.visibility === vis);
    }

    let list = pool;
    if (tab === "upcoming") {
      list = pool.filter((e) => !isPast(e.startsAt) && e.status !== "cancelled");
    } else if (tab === "past") {
      list = pool.filter((e) => isPast(e.startsAt));
    }

    return [...list].sort((a, b) =>
      tab === "past"
        ? +new Date(b.startsAt) - +new Date(a.startsAt)
        : +new Date(a.startsAt) - +new Date(b.startsAt),
    );
  }, [events, isGuest, tab, vis]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Workshops, panels, hackathons, and socials"
        actions={
          isOfficer ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/events/approvals">
                  <ShieldCheck /> Review approvals
                </Link>
              </Button>
              <Button asChild>
                <Link href="/events/new">
                  <Plus /> New event
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            {isOfficer && <TabsTrigger value="all">All</TabsTrigger>}
          </TabsList>
        </Tabs>
        {!isGuest && (
          <ToggleGroup
            type="single"
            value={vis}
            onValueChange={(v) => v && setVis(v as Vis)}
            variant="outline"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="public">Public</ToggleGroupItem>
            <ToggleGroupItem value="private">Private</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {items.length === 0 ? (
        tab === "past" ? (
          <p className="py-8 text-sm text-muted-foreground">
            No past events yet.
          </p>
        ) : (
          <EmptyState
            icon={CalendarOff}
            title="No upcoming events"
            body="Check back soon, or browse past events for what we have done before."
          />
        )
      ) : (
        <div className="space-y-3">
          {items.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
