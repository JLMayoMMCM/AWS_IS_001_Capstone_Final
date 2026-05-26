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
  CourseCombobox,
  type CourseOption,
} from "@/components/cloudcampus/course-combobox";
import { FileUpload, uploadFile } from "@/components/cloudcampus/file-upload";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { LookupRow } from "@/lib/lookups";
import type { Member } from "@/lib/types";

/** Edit form for a member's own profile (WIRE §5.16, FR-MEM-04). */
export function ProfileForm({
  member,
  courses,
}: {
  member: Member;
  courses: LookupRow[];
}) {
  const courseOptions: CourseOption[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Pending profile photo: kept client-side until the user clicks Save.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  // Form data captured at submit time, replayed once the member confirms.
  const pendingForm = useRef<FormData | null>(null);
  // Reference to the contact-email input so the "Use account email" button
  // can copy the sign-in address into it without re-rendering the form.
  const contactEmailRef = useRef<HTMLInputElement>(null);

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
      // Upload the new photo (if any) first so a /api/profile/photo failure
      // doesn't leave the profile partially saved.
      let photoUploaded = false;
      if (photoFile) {
        const up = await uploadFile(photoFile, "photo");
        const res = await fetch("/api/profile/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: up.key }),
        });
        if (!res.ok) {
          setError("Could not save your photo.");
          setSaving(false);
          return;
        }
        photoUploaded = true;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          courseId: form.get("courseId"),
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
      setPhotoFile(null);
      setSaved(true);
      setSaving(false);
      // Full reload after a photo change refreshes the cached avatar image
      // everywhere; otherwise a router.refresh() keeps state in place.
      if (photoUploaded) window.location.reload();
      else router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Full reload — server components otherwise hold the previous session.
    window.location.assign("/");
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
              onChange={setPhotoFile}
            />
            {photoFile && (
              <p className="text-xs text-muted-foreground">
                New photo will be uploaded when you save.
              </p>
            )}
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
              <CourseCombobox
                courses={courseOptions}
                defaultValue={member.courseId}
                name="courseId"
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
              ref={contactEmailRef}
              defaultValue={member.email ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Shown on your public profile.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (contactEmailRef.current) {
                  contactEmailRef.current.value = member.accountEmail;
                }
              }}
            >
              Use account email
            </Button>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <EmailChangeSection currentEmail={member.accountEmail} />

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

/**
 * Sign-in email change. Re-auth + send a confirmation link to the NEW
 * address. The account address only changes once the link in the email is
 * opened (POST /api/profile/email/confirm). (V2.1 §4)
 */
function EmailChangeSection({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/profile/email/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: newEmail.trim(),
          currentPassword: password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        delivered?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not start the email change.");
        return;
      }
      setSent(newEmail.trim());
      setNewEmail("");
      setPassword("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Sign-in email</h2>
          <p className="text-sm text-muted-foreground">{currentEmail}</p>
        </div>
        {!open && !sent && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
          >
            Change email
          </Button>
        )}
      </div>
      {sent && (
        <Alert variant="success">
          <AlertDescription>
            We sent a confirmation link to <b>{sent}</b>. Open it from that
            inbox to finish the change. Your account email stays the same
            until then.
          </AlertDescription>
        </Alert>
      )}
      {open && !sent && (
        <form onSubmit={submit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="newEmail">New email</Label>
            <Input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Confirms the change is really you.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setError(null);
                setNewEmail("");
                setPassword("");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Sending…" : "Send confirmation email"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
