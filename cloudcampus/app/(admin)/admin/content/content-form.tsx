"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/cloudcampus/confirm-dialog";
import type { OrgInfo } from "@/lib/org";

/** Edit form for the organization profile shown on public pages (FR-ADM-08). */
export function ContentForm({ org }: { org: OrgInfo }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Form data captured at submit time, replayed once the admin confirms.
  const pendingForm = useRef<FormData | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pendingForm.current = new FormData(event.currentTarget);
    setConfirmOpen(true);
  }

  async function runSave() {
    const form = pendingForm.current;
    if (!form) return;
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          shortName: form.get("shortName"),
          tagline: form.get("tagline"),
          about: form.get("about"),
          contactEmail: form.get("contactEmail"),
          contactAddress: form.get("contactAddress"),
          contactHours: form.get("contactHours"),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save the site content.");
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <>
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
        {saved && (
          <Alert variant="success">
            <AlertDescription>Site content updated.</AlertDescription>
          </Alert>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Organization</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={org.name}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shortName">Short name</Label>
              <Input
                id="shortName"
                name="shortName"
                defaultValue={org.shortName}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              name="tagline"
              defaultValue={org.tagline}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="about">About</Label>
            <Textarea
              id="about"
              name="about"
              rows={6}
              defaultValue={org.about.join("\n\n")}
            />
            <p className="text-xs text-muted-foreground">
              One paragraph per blank line.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>School year</Label>
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              {org.term || "No current school year set."}
            </p>
            <p className="text-xs text-muted-foreground">
              Managed under{" "}
              <a className="underline" href="/admin/school-years">
                Admin → School years
              </a>
              .
            </p>
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Contact</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={org.contact.email}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactAddress">Contact address</Label>
              <Input
                id="contactAddress"
                name="contactAddress"
                defaultValue={org.contact.address}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactHours">Office hours</Label>
              <Input
                id="contactHours"
                name="contactHours"
                defaultValue={org.contact.hours}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save site content?"
        description="The organization profile will be updated across the public site."
        confirmLabel="Save changes"
        onConfirm={runSave}
      />
    </>
  );
}
