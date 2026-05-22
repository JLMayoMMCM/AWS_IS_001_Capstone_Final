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

/** A blog attachment chosen in the form: an uploaded image or an external link. */
interface AttachmentDraft {
  kind: "image" | "link";
  key: string | null;
  url: string | null;
  label: string;
}

/** Submit form for a new blog post (FR-MEM-06). Saved as status 'pending'. */
export function BlogForm() {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Cover image S3 key, set once a cover has been uploaded. Covers are optional.
  const [coverKey, setCoverKey] = useState<string | null>(null);
  // Attachments chosen so far — uploaded images and external links.
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  // Draft values for the "add link" inputs; not part of the form's FormData.
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  // Form data captured at submit time, replayed once the author confirms.
  const pendingForm = useRef<FormData | null>(null);

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setAttachments((prev) => [
      ...prev,
      { kind: "link", key: null, url, label: linkLabel.trim() },
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
      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          bodyMarkdown: form.get("body"),
          visibility: isPublic ? "public" : "private",
          coverKey,
          attachments,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not submit your post.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      router.push("/blogs");
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
        <h2 className="text-lg font-semibold">Post</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
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
            onUploaded={(f) =>
              setAttachments((prev) => [
                ...prev,
                { kind: "image", key: f.key, url: null, label: f.fileName },
              ])
            }
          />
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
          Submitted posts are reviewed by an admin before they appear.
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this post for review?"
        description="Your post will be sent to an admin for review and will appear once it is approved."
        confirmLabel="Submit for review"
        onConfirm={runSubmit}
      />
    </form>
  );
}
