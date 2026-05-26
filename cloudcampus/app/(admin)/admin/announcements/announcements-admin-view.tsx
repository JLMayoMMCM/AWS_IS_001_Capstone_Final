"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { formatDate } from "@/lib/format";
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementLevel,
} from "@/lib/types";

interface FormState {
  id?: string;
  title: string;
  bodyMarkdown: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  publishedAt: string;
  expiresAt: string;
  pinnedUntil: string;
}

function emptyForm(): FormState {
  return {
    title: "",
    bodyMarkdown: "",
    level: "normal",
    audience: "members",
    publishedAt: "",
    expiresAt: "",
    pinnedUntil: "",
  };
}

function toFormState(a: Announcement): FormState {
  return {
    id: a.id,
    title: a.title,
    bodyMarkdown: a.bodyMarkdown,
    level: a.level,
    audience: a.audience,
    publishedAt: a.publishedAt.slice(0, 16),
    expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : "",
    pinnedUntil: a.pinnedUntil ? a.pinnedUntil.slice(0, 16) : "",
  };
}

function EditorDialog({
  state,
  open,
  onOpenChange,
  onSaved,
}: {
  state: FormState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      bodyMarkdown: form.bodyMarkdown.trim(),
      level: form.level,
      audience: form.audience,
      publishedAt: form.publishedAt || null,
      expiresAt: form.expiresAt || null,
      pinnedUntil: form.pinnedUntil || null,
    };
    if (!payload.title || !payload.bodyMarkdown) {
      setError("Title and body are required.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(
        form.id
          ? `/api/admin/announcements/${form.id}`
          : "/api/admin/announcements",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save the announcement.");
        setBusy(false);
        return;
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {form.id ? "Edit announcement" : "New announcement"}
          </DialogTitle>
          <DialogDescription>
            Pick an audience and a level. Critical and elevated announcements
            also surface in the site-wide banner.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              rows={6}
              value={form.bodyMarkdown}
              onChange={(e) =>
                setForm({ ...form, bodyMarkdown: e.target.value })
              }
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="level">Level</Label>
              <NativeSelect
                id="level"
                value={form.level}
                onChange={(e) =>
                  setForm({
                    ...form,
                    level: e.target.value as AnnouncementLevel,
                  })
                }
              >
                <NativeSelectOption value="normal">Normal</NativeSelectOption>
                <NativeSelectOption value="elevated">Elevated</NativeSelectOption>
                <NativeSelectOption value="critical">Critical</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audience">Audience</Label>
              <NativeSelect
                id="audience"
                value={form.audience}
                onChange={(e) =>
                  setForm({
                    ...form,
                    audience: e.target.value as AnnouncementAudience,
                  })
                }
              >
                <NativeSelectOption value="public">Public</NativeSelectOption>
                <NativeSelectOption value="members">Members</NativeSelectOption>
                <NativeSelectOption value="officers">Officers</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="publishedAt">Publish at</Label>
              <Input
                id="publishedAt"
                type="date"
                value={form.publishedAt}
                onChange={(e) =>
                  setForm({ ...form, publishedAt: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expires at</Label>
              <Input
                id="expiresAt"
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm({ ...form, expiresAt: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pinnedUntil">Pin until</Label>
              <Input
                id="pinnedUntil"
                type="date"
                value={form.pinnedUntil}
                onChange={(e) =>
                  setForm({ ...form, pinnedUntil: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : form.id ? "Save" : "Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementsAdminView({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorState, setEditorState] = useState<FormState>(emptyForm());

  function openNew() {
    setEditorState(emptyForm());
    setEditorOpen(true);
  }
  function openEdit(a: Announcement) {
    setEditorState(toFormState(a));
    setEditorOpen(true);
  }

  async function deleteAnnouncement(id: string) {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New announcement
        </Button>
      </div>

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          body="Post the first announcement to keep members in the loop."
        />
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{a.title}</h3>
                  <Badge variant="secondary" className="uppercase">
                    {a.level}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {a.audience}
                  </Badge>
                  {a.pinnedUntil && new Date(a.pinnedUntil) > new Date() && (
                    <Badge>Pinned</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Published {formatDate(a.publishedAt)}
                  {a.expiresAt
                    ? ` · expires ${formatDate(a.expiresAt)}`
                    : ""}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {a.bodyMarkdown}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(a)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <ConfirmButton
                  size="sm"
                  variant="outline"
                  title="Delete announcement?"
                  description="This cannot be undone."
                  confirmLabel="Delete"
                  confirmVariant="destructive"
                  onConfirm={() => deleteAnnouncement(a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EditorDialog
        key={editorState.id ?? "new"}
        state={editorState}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
