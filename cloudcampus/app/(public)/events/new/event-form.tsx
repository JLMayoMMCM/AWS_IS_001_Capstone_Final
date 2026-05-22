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
import { FileUpload } from "@/components/cloudcampus/file-upload";

/** Submit form for a new event (WIRE §5.15.1, FR-OFF-02). Saved as 'pending'. */
export function EventForm() {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Cover image S3 key, set once a cover has been uploaded. Covers are optional.
  const [coverKey, setCoverKey] = useState<string | null>(null);
  // Form data captured at submit time, replayed once the officer confirms.
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
      const res = await fetch("/api/events", {
        method: "POST",
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
        setError(data.error ?? "Could not create the event.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      router.push(data.slug ? `/events/${data.slug}` : "/events");
    } catch {
      setError("Something went wrong. Please try again.");
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Short description</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            maxLength={280}
            required
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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endsAt">Ends at</Label>
            <Input id="endsAt" name="endsAt" type="datetime-local" required />
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
            placeholder="e.g. Innovation Hub, Tech Building"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="locationUrl">Location URL</Label>
          <Input
            id="locationUrl"
            name="locationUrl"
            type="url"
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
        <FileUpload
          purpose="cover"
          accept="image/*"
          onUploaded={(f) => setCoverKey(f.key)}
        />
        {coverKey && (
          <p className="text-xs text-muted-foreground">Cover added</p>
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
          Your event is sent to the three approver positions for review.
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for approval"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this event for approval?"
        description="Your event will be sent to the three approver positions. It is published once all of them approve."
        confirmLabel="Submit for approval"
        onConfirm={runSubmit}
      />
    </form>
  );
}
