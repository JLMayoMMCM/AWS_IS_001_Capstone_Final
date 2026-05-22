"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/cloudcampus/confirm-dialog";
import {
  FileUpload,
  type UploadedFile,
} from "@/components/cloudcampus/file-upload";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { Member } from "@/lib/types";

/** Edit form for a member's own profile (WIRE §5.16, FR-MEM-04). */
export function ProfileForm({ member }: { member: Member }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Form data captured at submit time, replayed once the member confirms.
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

    const yearValue = form.get("year");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          course: form.get("course"),
          year: yearValue ? Number(yearValue) : null,
          bio: form.get("bio"),
          contactEmail: form.get("contactEmail"),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save your profile.");
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

  async function handlePhotoUploaded(file: UploadedFile) {
    const res = await fetch("/api/profile/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: file.key }),
    });
    // A full reload refreshes the cached avatar image everywhere.
    if (res.ok) window.location.reload();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  }

  return (
    <div className="space-y-6">
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
            <AlertDescription>Profile updated.</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <UserAvatar name={member.name} memberId={member.id} size="2xl" />
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Upload a square image for your profile photo.
            </p>
            <FileUpload
              purpose="photo"
              accept="image/*"
              onUploaded={handlePhotoUploaded}
            />
          </div>
        </div>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Identity</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={member.name}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                defaultValue={member.studentId ?? ""}
                disabled
              />
              <p className="text-xs text-muted-foreground">Set by an admin.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course">Course</Label>
              <Input
                id="course"
                name="course"
                defaultValue={member.course ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year">Year level</Label>
              <NativeSelect
                id="year"
                name="year"
                defaultValue={member.year ? String(member.year) : ""}
                className="w-full"
              >
                <NativeSelectOption value="">Not set</NativeSelectOption>
                <NativeSelectOption value="1">Year 1</NativeSelectOption>
                <NativeSelectOption value="2">Year 2</NativeSelectOption>
                <NativeSelectOption value="3">Year 3</NativeSelectOption>
                <NativeSelectOption value="4">Year 4</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">About</h2>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              rows={4}
              defaultValue={member.bio ?? ""}
              placeholder="A short introduction for your profile."
            />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Contact</h2>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={member.email ?? ""}
            />
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="rounded-xl bg-card p-6 text-card-foreground ring-1 ring-destructive/40">
        <h2 className="text-lg font-semibold">Sign out</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign out of CloudCampus on this device.
        </p>
        <Button variant="destructive" className="mt-4" onClick={signOut}>
          Sign out
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save profile changes?"
        description="Your profile details will be updated across CloudCampus."
        confirmLabel="Save changes"
        onConfirm={runSave}
      />
    </div>
  );
}
