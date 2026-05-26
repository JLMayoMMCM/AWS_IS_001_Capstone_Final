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
import type { Attachment, BlogPost } from "@/lib/types";

/**
 * A blog attachment chosen in the form. For `kind: "image"` it holds the raw
 * File until submit; the upload happens then and `key` is filled in. For
 * `kind: "link"` only `url` + `label` are used. `existingKey` is set when the
 * row was loaded from the DB — the image is already in S3 and we keep the key
 * verbatim on save unless the user removes it.
 */
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

/**
 * Submit / edit form for a blog post (FR-MEM-06, V2.1 §1.2). When `existing`
 * is omitted the form POSTs to /api/blogs to create a new draft; when set it
 * PATCHes /api/blogs/[id], which flips the status back to 'pending' so an
 * officer re-reviews the edit (V2.1 §1.3).
 */
export function BlogForm({ existing }: { existing?: BlogPost } = {}) {
  const router = useRouter();
  const isEdit = Boolean(existing);
  const [isPublic, setIsPublic] = useState(
    existing ? existing.visibility === "public" : true,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Pending cover image, kept client-side until submit.
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // Whether the existing cover should be kept after save. Removing it means
  // no cover_s3_key gets sent (unless a new file is chosen).
  const [keepExistingCover, setKeepExistingCover] = useState(true);
  // Pending "next image attachment" picker.
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  // Attachments queued so far (existing + newly added).
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

      const url = isEdit ? `/api/blogs/${existing!.id}` : "/api/blogs";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          bodyMarkdown: form.get("body"),
          visibility: isPublic ? "public" : "private",
          coverKey,
          attachments: resolvedAttachments,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save your post.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      router.push(isEdit ? `/blogs/${existing!.slug}` : "/blogs");
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
            Saving will return this post to the review queue
            {existing?.status ? ` (current status: ${existing.status})` : ""}.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Post</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={existing?.title ?? ""}
            placeholder="e.g. Getting Started with the AWS Free Tier"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Body</Label>
          <Textarea
            id="body"
            name="body"
            rows={12}
            required
            defaultValue={existing?.bodyMarkdown ?? ""}
            placeholder="Write your post. Markdown is supported; blank lines start new paragraphs."
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cover image</h2>
        <p className="text-xs text-muted-foreground">
          Optional. Shown at the top of the post and on blog cards.
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
          Optional. Add images or external links to include with the post.
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
              Public posts are visible to everyone once approved. Private posts
              are visible to members only.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? "Edits return the post to the review queue."
            : "Submitted posts are reviewed by an admin before they appear."}
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
        title={isEdit ? "Save these changes?" : "Submit this post for review?"}
        description={
          isEdit
            ? "Your edited post returns to the review queue. It will reappear publicly once an officer re-approves it."
            : "Your post will be sent to an admin for review and will appear once it is approved."
        }
        confirmLabel={isEdit ? "Save changes" : "Submit for review"}
        onConfirm={runSubmit}
      />
    </form>
  );
}
