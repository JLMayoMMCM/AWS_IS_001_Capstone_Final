"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Inline approval / rejection / revision-request UI shown on a content detail
 * page (V2.1 §2). Reused by blogs, projects, and events — the parent passes
 * an `entity` discriminator and the id, and the panel posts to the right
 * status endpoint.
 *
 * Visibility (Approve / Reject / Request revision) is determined by the
 * entity's current status and what the viewer is allowed to do. Events also
 * support "request revision" via the same endpoint shape, but blogs/projects
 * use the simpler approved/rejected pair.
 */
export function ApprovalPanel({
  entity,
  id,
  status,
}: {
  entity: "blog" | "project" | "event";
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  // Which dialog is open: approve / reject / revise
  const [mode, setMode] = useState<"approve" | "reject" | "revise" | null>(
    null,
  );

  const isPending = status === "pending";

  if (!isPending) {
    return (
      <p className="text-xs text-muted-foreground">
        This item is {status}. No further review is needed.
      </p>
    );
  }

  async function submit(decision: "approved" | "rejected" | "revision_requested") {
    setError(null);
    setBusy(true);
    try {
      let url: string;
      let body: Record<string, unknown>;
      if (entity === "event") {
        url = `/api/events/${id}/approvals`;
        body = { decision, comment: comment.trim() };
      } else if (entity === "project") {
        // V2.1 extension: projects use the same unanimous vote flow as events.
        url = `/api/projects/${id}/approvals`;
        body = { decision, comment: comment.trim() };
      } else {
        // Blogs still use the simple admin/officer approve-or-reject endpoint;
        // they don't have a revision_requested status enum value yet.
        url = `/api/admin/blogs/${id}/status`;
        body = {
          status: decision === "approved" ? "approved" : "rejected",
          comment: comment.trim(),
        };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save the decision.");
        setBusy(false);
        return;
      }
      setMode(null);
      setComment("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <p className="text-sm font-semibold">Officer review</p>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => submit("approved")}
            disabled={busy}
          >
            {busy ? "Working…" : "Approve"}
          </Button>
          {(entity === "event" || entity === "project") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMode("revise")}
              disabled={busy}
            >
              Request revision
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setMode("reject")}
            disabled={busy}
          >
            Reject
          </Button>
        </div>
      )}
      {(mode === "reject" || mode === "revise") && (
        <div className="space-y-2">
          <Label htmlFor="approval-comment">
            {mode === "reject" ? "Rejection reason" : "What needs revising?"}
          </Label>
          <Textarea
            id="approval-comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              mode === "reject"
                ? "Explain why this is being rejected (visible in the audit log)."
                : "Tell the author what to change."
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode(null);
                setComment("");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "reject" ? "destructive" : "outline"}
              disabled={busy || comment.trim() === ""}
              onClick={() =>
                submit(
                  mode === "reject" ? "rejected" : "revision_requested",
                )
              }
            >
              {busy
                ? "Saving…"
                : mode === "reject"
                  ? "Confirm rejection"
                  : "Send revision request"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
