"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Inbox, TriangleAlert, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { cn } from "@/lib/utils";
import type { ApprovalVote } from "@/lib/queries";
import type { OrgEvent } from "@/lib/types";

type PendingEvent = OrgEvent & { votes: ApprovalVote[] };

/** One row in the approver queue (WIRE §5.15.2). */
function ApprovalCard({
  event,
  currentMemberId,
  myPositionId,
}: {
  event: PendingEvent;
  currentMemberId: string;
  myPositionId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  const isOwnEvent = event.createdBy === currentMemberId;
  const myVote =
    event.votes.find((v) => v.positionId === myPositionId)?.decision ?? null;

  async function castVote(decision: "approved" | "rejected", reason: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: reason }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not record your vote.");
        setBusy(false);
        return;
      }
      setRejectOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <div>
        <h3 className="text-lg font-semibold leading-tight">{event.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <UserAvatar name={event.createdByName || "Officer"} size="xs" />
          <span>
            Submitted by {event.createdByName || "an officer"}
            {event.createdByPosition ? `, ${event.createdByPosition}` : ""}
          </span>
        </div>
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">
        {event.summary}
      </p>

      {/* Approver-position vote chips */}
      <div className="flex flex-wrap gap-1.5">
        {event.votes.map((vote) => {
          const mine = vote.positionId === myPositionId;
          const cls =
            vote.decision === "approved"
              ? "bg-success text-success-foreground"
              : vote.decision === "rejected"
                ? "bg-destructive text-destructive-foreground"
                : "bg-muted text-muted-foreground";
          return (
            <span
              key={vote.positionId}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                cls,
                mine && "ring-2 ring-ring ring-offset-1 ring-offset-background",
              )}
            >
              {vote.decision === "approved" ? (
                <Check className="h-3 w-3" />
              ) : vote.decision === "rejected" ? (
                <X className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {vote.positionName}
            </span>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {isOwnEvent ? (
          <p className="text-sm text-muted-foreground italic">
            You created this event — you cannot vote on it.
          </p>
        ) : myVote ? (
          <p className="text-sm text-muted-foreground italic">
            You voted to {myVote} this event.
          </p>
        ) : (
          <>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
            >
              <X /> Reject
            </Button>
            <ConfirmButton
              size="sm"
              disabled={busy}
              title="Approve this event?"
              description={`Your approval vote for “${event.title}” will be recorded. The event is published once every approver position has voted to approve.`}
              confirmLabel="Approve"
              onConfirm={() => castVote("approved", "")}
            >
              <Check /> Approve
            </ConfirmButton>
          </>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this event?</DialogTitle>
            <DialogDescription>
              A reason is required so the organizer knows what to change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${event.id}`}>Reason</Label>
            <Textarea
              id={`reason-${event.id}`}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain what needs to change."
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || comment.trim().length === 0}
              onClick={() => castVote("rejected", comment.trim())}
            >
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ApprovalQueue({
  events,
  currentMemberId,
  myPositionId,
}: {
  events: PendingEvent[];
  currentMemberId: string;
  myPositionId: string;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="All caught up"
        body="There are no events waiting for approval right now."
      />
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <ApprovalCard
          key={event.id}
          event={event}
          currentMemberId={currentMemberId}
          myPositionId={myPositionId}
        />
      ))}
    </div>
  );
}
