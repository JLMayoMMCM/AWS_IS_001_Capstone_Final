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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/cloudcampus/confirm-dialog";
import { FileUpload, uploadFile } from "@/components/cloudcampus/file-upload";
import type { LookupRow } from "@/lib/lookups";
import type { Attachment, Project } from "@/lib/types";

interface AttachmentDraft {
  kind: "image" | "link";
  file: File | null;
  key: string | null;
  url: string | null;
  label: string;
}

function attachmentsFromExisting(items: Attachment[]): AttachmentDraft[] {
  return items.map((a) => ({
    kind: a.kind,
    file: null,
    key: a.kind === "image" ? a.key : null,
    url: a.kind === "link" ? a.url : null,
    label: a.label,
  }));
}

/** Create / edit form for a project (FR-MEM-07, V2.1 §1.2 + §0.7). */
export function ProjectForm({
  categories,
  existing,
}: {
  categories: LookupRow[];
  existing?: Project;
}) {
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
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>(
    existing ? attachmentsFromExisting(existing.attachments) : [],
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const pendingForm = useRef<FormData | null>(null);

  function addImage() {
    if (!pendingImage) return;
    setAttachments((prev) => [
      ...prev,
      {
        kind: "image",
        file: pendingImage,
        key: null,
        url: null,
        label: pendingImage.name,
      },
    ]);
    setPendingImage(null);
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setAttachments((prev) => [
      ...prev,
      { kind: "link", file: null, key: null, url, label: linkLabel.trim() },
    ]);
    setLinkUrl("");
    setLinkLabel("");
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pendingForm.current = new FormData(event.currentTarget);
    setConfirmOpen(true);
  }

  async function runSubmit() {
    const form = pendingForm.current;
    if (!form) return;
    setError(null);
    setSubmitting(true);

    try {
      let coverKey: string | null = null;
      if (coverFile) {
        coverKey = (await uploadFile(coverFile, "cover")).key;
      } else if (isEdit && keepExistingCover) {
        coverKey = existing?.coverKey ?? null;
      }
      const resolvedAttachments = await Promise.all(
        attachments.map(async (a) => {
          if (a.kind === "image" && a.file) {
            const up = await uploadFile(a.file, "attachment");
            return { kind: a.kind, key: up.key, url: null, label: a.label };
          }
          return { kind: a.kind, key: a.key, url: a.url, label: a.label };
        }),
      );

      const url = isEdit ? `/api/projects/${existing!.id}` : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          bodyMarkdown: form.get("body"),
          repoUrl: form.get("repoUrl"),
          liveUrl: form.get("liveUrl"),
          publishedUrl: form.get("publishedUrl"),
          techStack: form.get("techStack"),
          tags: form.get("tags"),
          visibility: isPublic ? "public" : "private",
          categoryId: form.get("categoryId") || null,
          coverKey,
          attachments: resolvedAttachments,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save your project.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      router.push(isEdit ? `/projects/${existing!.id}` : "/projects");
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
            Saving will return this project to the review queue
            {existing?.status ? ` (current status: ${existing.status})` : ""}.
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
            placeholder="One or two sentences shown on project cards."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Details</Label>
          <Textarea
            id="body"
            name="body"
            rows={8}
            defaultValue={existing?.bodyMarkdown ?? ""}
            placeholder="Optional longer write-up. Blank lines start new paragraphs."
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Links &amp; tech</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="repoUrl">Repository URL</Label>
            <Input
              id="repoUrl"
              name="repoUrl"
              type="url"
              defaultValue={existing?.repoUrl ?? ""}
              placeholder="https://github.com/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="liveUrl">Live demo URL</Label>
            <Input
              id="liveUrl"
              name="liveUrl"
              type="url"
              defaultValue={existing?.liveUrl ?? ""}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="publishedUrl">Published URL (optional)</Label>
          <Input
            id="publishedUrl"
            name="publishedUrl"
            type="url"
            defaultValue={existing?.publishedUrl ?? ""}
            placeholder="https://… (app store, marketplace, paper, etc.)"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="techStack">Tech stack</Label>
          <Input
            id="techStack"
            name="techStack"
            defaultValue={existing?.stack.join(", ") ?? ""}
            placeholder="Next.js, PostgreSQL, AWS"
          />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            name="tags"
            defaultValue={existing?.tags.join(", ") ?? ""}
            placeholder="web, hackathon"
          />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Category</h2>
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Category</Label>
          <NativeSelect
            id="categoryId"
            name="categoryId"
            defaultValue={existing?.categoryId ?? ""}
          >
            <NativeSelectOption value="">Uncategorized</NativeSelectOption>
            {categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cover image</h2>
        <p className="text-xs text-muted-foreground">
          Optional. Shown at the top of the project and on project cards.
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Attachments</h2>
        <p className="text-xs text-muted-foreground">
          Optional. Add images or external links to include with the project.
        </p>
        <div className="space-y-1.5">
          <Label>Add an image</Label>
          <FileUpload
            key={attachments.length}
            purpose="attachment"
            accept="image/*"
            onChange={setPendingImage}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addImage}
            disabled={!pendingImage}
          >
            Add image
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attachmentUrl">Add a link</Label>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              id="attachmentUrl"
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <Input
              id="attachmentLabel"
              placeholder="Label (optional)"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLink}
            disabled={!linkUrl.trim()}
          >
            Add link
          </Button>
        </div>
        {attachments.length > 0 && (
          <ul className="space-y-1.5">
            {attachments.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-1.5"
              >
                <span className="truncate text-sm">
                  {a.label || a.url}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(i)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
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
              Public projects are visible to everyone once approved. Private
              projects are visible to members only.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? "Edits return the project to the review queue."
            : "Submitted projects are reviewed by an admin before they appear."}
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Submitting…"
            : isEdit
              ? "Save changes"
              : "Submit for review"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isEdit ? "Save these changes?" : "Submit this project for review?"
        }
        description={
          isEdit
            ? "Your edited project returns to the review queue. It will reappear publicly once an admin re-approves it."
            : "Your project will be sent to an admin for review and will appear once it is approved."
        }
        confirmLabel={isEdit ? "Save changes" : "Submit for review"}
        onConfirm={runSubmit}
      />
    </form>
  );
}
