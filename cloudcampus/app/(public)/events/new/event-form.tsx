"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/cloudcampus/confirm-dialog";
import { FileUpload, uploadFile } from "@/components/cloudcampus/file-upload";
import type { OrgEvent } from "@/lib/types";

/** datetime-local input wants `YYYY-MM-DDTHH:mm` — strip seconds + zone. */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Create / edit form for an event (WIRE §5.15.1, FR-OFF-02, V2.1 §1.2). */
export function EventForm({ existing }: { existing?: OrgEvent } = {}) {
  const router = useRouter();
  const isEdit = Boolean(existing);
  const [isPublic, setIsPublic] = useState(
    existing ? existing.visibility === "public" : true,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [keepExistingCover, setKeepExistingCover] = useState(true);
  const pendingForm = useRef<FormData | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("startsAt") ?? "");
    const endsAt = String(form.get("endsAt") ?? "");
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("The end time must be after the start time.");
      return;
    }
    pendingForm.current = form;
    setConfirmOpen(true);
  }

  async function runSubmit() {
    const form = pendingForm.current;
    if (!form) return;
    const startsAt = String(form.get("startsAt") ?? "");
    const endsAt = String(form.get("endsAt") ?? "");

    setSubmitting(true);
    try {
      let coverKey: string | null = null;
      if (coverFile) {
        coverKey = (await uploadFile(coverFile, "cover")).key;
      } else if (isEdit && keepExistingCover) {
        coverKey = existing?.coverKey ?? null;
      }
      const url = isEdit ? `/api/events/${existing!.id}` : "/api/events";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          bodyMarkdown: form.get("body"),
          location: form.get("location"),
          locationUrl: form.get("locationUrl"),
          startsAt,
          endsAt,
          visibility: isPublic ? "public" : "private",
          coverKey,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save the event.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      router.push(
        isEdit
          ? `/events/${existing!.slug}`
          : data.slug
            ? `/events/${data.slug}`
            : "/events",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10"
    >
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isEdit && existing?.status !== "approved" && (
        <Alert>
          <AlertDescription>
            Saving will return this event to the approver queue. All previous
            officer votes will be cleared.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={existing?.title ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Short description</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            maxLength={280}
            required
            defaultValue={existing?.summary ?? ""}
            placeholder="One or two sentences shown on event cards."
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">When</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="startsAt">Starts at</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={toLocalInput(existing?.startsAt)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endsAt">Ends at</Label>
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={toLocalInput(existing?.endsAt)}
            />
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Where</h2>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            required
            defaultValue={existing?.location ?? ""}
            placeholder="e.g. Innovation Hub, Tech Building"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="locationUrl">Location URL</Label>
          <Input
            id="locationUrl"
            name="locationUrl"
            type="url"
            defaultValue={existing?.locationUrl ?? ""}
            placeholder="https://… (map or meeting link, optional)"
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <div className="space-y-1.5">
          <Label htmlFor="body">Body</Label>
          <Textarea
            id="body"
            name="body"
            rows={8}
            defaultValue={existing?.bodyMarkdown ?? ""}
            placeholder="What to expect, what to bring, the schedule…"
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cover image</h2>
        <p className="text-xs text-muted-foreground">
          Optional. Shown at the top of the event and on event cards.
        </p>
        {isEdit && existing?.coverKey && keepExistingCover && !coverFile && (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <span className="truncate text-muted-foreground">
              Current cover kept
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setKeepExistingCover(false)}
            >
              Remove
            </Button>
          </div>
        )}
        <FileUpload
          purpose="cover"
          accept="image/*"
          onChange={(f) => {
            setCoverFile(f);
            if (f) setKeepExistingCover(false);
          }}
        />
        {coverFile && (
          <p className="text-xs text-muted-foreground">
            Will be uploaded when you submit.
          </p>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Visibility</h2>
        <div className="flex items-start gap-3">
          <Switch
            id="visibility"
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
          <div>
            <Label htmlFor="visibility">Public</Label>
            <p className="text-xs text-muted-foreground">
              Public events appear to everyone once approved. Private events are
              visible to members only.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? "Edits return the event to the approval queue."
            : "Your event is sent to the approver pool for review."}
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Submitting…"
            : isEdit
              ? "Save changes"
              : "Submit for approval"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isEdit
            ? "Save these changes?"
            : "Submit this event for approval?"
        }
        description={
          isEdit
            ? "Your edited event returns to the approval queue. Previous officer votes are cleared and approvers will vote again."
            : "Your event will be sent to the approver pool. It is published once every approver votes to approve; any single rejection sends it back."
        }
        confirmLabel={isEdit ? "Save changes" : "Submit for approval"}
        onConfirm={runSubmit}
      />
    </form>
  );
}
