"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Files, TriangleAlert, Upload } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfirmButton,
  ConfirmDialog,
} from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import {
  FileUpload,
  type UploadedFile,
} from "@/components/cloudcampus/file-upload";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { ResourceIcon } from "@/components/cloudcampus/resource-icon";
import type { ResourceItem } from "@/lib/types";

function ResourceRow({ resource }: { resource: ResourceItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <ResourceIcon
            type={resource.type}
            className="h-4 w-4 text-muted-foreground"
          />
          {resource.title}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {resource.category}
      </TableCell>
      <TableCell className="font-mono text-xs uppercase text-muted-foreground">
        {resource.type} · {resource.size}
      </TableCell>
      <TableCell>
        <Badge
          variant={resource.visibility === "private" ? "outline" : "secondary"}
        >
          {resource.visibility}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setRenameOpen(true)}
          >
            Rename
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setReplaceOpen(true)}
          >
            Replace
          </Button>
          <ConfirmButton
            variant="destructive"
            size="sm"
            disabled={busy}
            title="Delete this resource?"
            description={`“${resource.title}” and its file will be permanently removed. This cannot be undone.`}
            confirmLabel="Delete"
            confirmVariant="destructive"
            onConfirm={remove}
          >
            Delete
          </ConfirmButton>
        </div>
      </TableCell>
      <RenameDialog
        resource={resource}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
      <ReplaceDialog
        resource={resource}
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
      />
    </TableRow>
  );
}

function RenameDialog({
  resource,
  open,
  onOpenChange,
}: {
  resource: ResourceItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(resource.visibility === "public");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Form data captured at submit time, replayed once the admin confirms.
  const pendingForm = useRef<FormData | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    pendingForm.current = new FormData(event.currentTarget);
    setConfirmOpen(true);
  }

  async function runSave() {
    const form = pendingForm.current;
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          category: form.get("category"),
          visibility: isPublic ? "public" : "private",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save the changes.");
        setBusy(false);
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit resource details</DialogTitle>
          <DialogDescription>
            Update the resource’s title, description, and visibility.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              name="title"
              required
              defaultValue={resource.title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rename-description">Description</Label>
            <Textarea
              id="rename-description"
              name="description"
              rows={2}
              defaultValue={resource.description}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rename-category">Category</Label>
            <Input
              id="rename-category"
              name="category"
              defaultValue={resource.category}
              placeholder="e.g. Onboarding"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="rename-visibility"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="rename-visibility">Public</Label>
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
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save changes?"
        description="The resource’s details will be updated with the values above."
        confirmLabel="Save changes"
        onConfirm={runSave}
      />
    </Dialog>
  );
}

function ReplaceDialog({
  resource,
  open,
  onOpenChange,
}: {
  resource: ResourceItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function runReplace() {
    if (!file) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: file.key,
          fileName: file.fileName,
          mimeType: file.contentType,
          size: file.size,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not replace the file.");
        return;
      }
      setFile(null);
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace the file</DialogTitle>
          <DialogDescription>
            Upload a new file to swap out the current one; its metadata stays.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>File</Label>
            <FileUpload purpose="resource" onUploaded={setFile} />
          </div>
          {!file && (
            <p className="text-xs text-muted-foreground">
              Upload a file to enable the replace action.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!file}
              onClick={() => setConfirmOpen(true)}
            >
              Replace file
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replace the file?"
        description="The current file is permanently replaced with the uploaded one."
        confirmLabel="Replace file"
        onConfirm={runReplace}
      />
    </Dialog>
  );
}

function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Form data captured at submit time, replayed once the admin confirms.
  const pendingForm = useRef<FormData | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose and upload a file first.");
      return;
    }
    pendingForm.current = new FormData(event.currentTarget);
    setConfirmOpen(true);
  }

  async function runSave() {
    const form = pendingForm.current;
    if (!form || !file) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: file.key,
          fileName: file.fileName,
          mimeType: file.contentType,
          size: file.size,
          title: form.get("title"),
          description: form.get("description"),
          category: form.get("category"),
          visibility: isPublic ? "public" : "private",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save the resource.");
        setBusy(false);
        return;
      }
      setFile(null);
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a resource</DialogTitle>
          <DialogDescription>
            The file is uploaded to S3; its metadata is saved here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>File</Label>
            <FileUpload purpose="resource" onUploaded={setFile} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              placeholder="e.g. Onboarding"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="visibility"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="visibility">Public</Label>
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
              {busy ? "Saving…" : "Save resource"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save this resource?"
        description="The uploaded file and its details will be added to the resources list."
        confirmLabel="Save resource"
        onConfirm={runSave}
      />
    </Dialog>
  );
}

export function ResourcesAdminView({
  resources,
}: {
  resources: ResourceItem[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        subtitle="Manage downloadable resources."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload /> Upload resource
          </Button>
        }
      />

      {resources.length === 0 ? (
        <EmptyState
          icon={Files}
          title="No resources"
          body="Upload a resource to get started."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
