"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmButton } from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { isPast } from "@/lib/format";
import type { OrgEvent } from "@/lib/types";

type Tab = "pending" | "approved" | "past" | "cancelled" | "all";

function inTab(event: OrgEvent, tab: Tab): boolean {
  switch (tab) {
    case "pending":
      return event.status === "pending";
    case "approved":
      return event.status === "approved" && !isPast(event.startsAt);
    case "past":
      return isPast(event.startsAt);
    case "cancelled":
      return event.status === "cancelled";
    default:
      return true;
  }
}

const STATUS_VARIANT: Record<
  string,
  "secondary" | "success" | "destructive" | "warning"
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "destructive",
  completed: "secondary",
  draft: "secondary",
};

function EventRow({ event }: { event: OrgEvent }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: "force-approve" | "cancel" | "delete") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{event.title}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {event.dateLabel}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {event.createdByName}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[event.status] ?? "secondary"}>
          {event.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap justify-end gap-1.5">
          {event.status === "pending" && (
            <ConfirmButton
              size="sm"
              disabled={busy}
              title="Force-approve this event?"
              description={`“${event.title}” will be published immediately, skipping the approver votes.`}
              confirmLabel="Force-approve"
              onConfirm={() => run("force-approve")}
            >
              Force-approve
            </ConfirmButton>
          )}
          {event.status !== "cancelled" && (
            <ConfirmButton
              variant="outline"
              size="sm"
              disabled={busy}
              title="Cancel this event?"
              description={`“${event.title}” will be marked cancelled. You can still edit it afterwards.`}
              confirmLabel="Cancel event"
              cancelLabel="Keep event"
              onConfirm={() => run("cancel")}
            >
              Cancel
            </ConfirmButton>
          )}
          <ConfirmButton
            variant="destructive"
            size="sm"
            disabled={busy}
            title="Delete this event?"
            description={`“${event.title}” will be permanently removed. This cannot be undone.`}
            confirmLabel="Delete"
            cancelLabel="Keep event"
            confirmVariant="destructive"
            onConfirm={() => run("delete")}
          >
            Delete
          </ConfirmButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function EventsAdminView({ events }: { events: OrgEvent[] }) {
  const [tab, setTab] = useState<Tab>("pending");
  const items = events.filter((e) => inTab(e, tab));

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <EmptyState icon={CalendarOff} title={`No ${tab} events`} />
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
