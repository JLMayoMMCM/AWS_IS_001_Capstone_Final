"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, TriangleAlert } from "lucide-react";

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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
import { PageHeader } from "@/components/cloudcampus/page-header";
import type { AdminForm } from "@/lib/queries";

/** A label for each form provider, shown in the table and badges. */
const PROVIDER_LABELS: Record<AdminForm["provider"], string> = {
  google: "Google",
  microsoft: "Microsoft",
};

/** One row of the forms table — renders metadata badges plus edit/delete. */
function FormRow({ form }: { form: AdminForm }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/forms/${form.id}`, {
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
        <span className="font-medium">{form.title}</span>
        {form.description && (
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {form.description}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{PROVIDER_LABELS[form.provider]}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={form.visibility === "private" ? "outline" : "secondary"}>
          {form.visibility}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={form.isActive ? "secondary" : "outline"}>
          {form.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
          <ConfirmButton
            variant="destructive"
            size="sm"
            disabled={busy}
            title="Delete this form?"
            description={`“${form.title}” will be removed from the Forms page.`}
            confirmLabel="Delete"
            confirmVariant="destructive"
            onConfirm={remove}
          >
            Delete
          </ConfirmButton>
        </div>
      </TableCell>
      <FormDialog form={form} open={editOpen} onOpenChange={setEditOpen} />
    </TableRow>
  );
}

/**
 * The create/edit dialog for a form link. Passing `form` puts it in edit mode
 * (PATCH); omitting it creates a new form (POST). The submission is gated
 * through a `ConfirmDialog`: `onSubmit` captures the form data and opens the
 * confirmation, which then replays the captured data on confirm.
 */
function FormDialog({
  form,
  open,
  onOpenChange,
}: {
  form?: AdminForm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(form);
  const [isPublic, setIsPublic] = useState(form?.visibility !== "private");
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
    const data = pendingForm.current;
    if (!data) return;
    setBusy(true);
    try {
      const body = JSON.stringify({
        title: data.get("title"),
        description: data.get("description"),
        provider: data.get("provider"),
        url: data.get("url"),
        embedHtml: data.get("embedHtml"),
        visibility: isPublic ? "public" : "private",
      });
      const res = await fetch(
        isEdit ? `/api/admin/forms/${form!.id}` : "/api/admin/forms",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error ?? "Could not save the form.");
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
          <DialogTitle>{isEdit ? "Edit form" : "New form"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details for this form link."
              : "Add a form link to show on the public Forms page."}
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
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={form?.title} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={form?.description}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider">Provider</Label>
            <NativeSelect
              id="provider"
              name="provider"
              defaultValue={form?.provider ?? "google"}
            >
              <NativeSelectOption value="google">Google</NativeSelectOption>
              <NativeSelectOption value="microsoft">
                Microsoft
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url">Form URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              defaultValue={form?.url}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="embedHtml">Embed HTML</Label>
            <Textarea
              id="embedHtml"
              name="embedHtml"
              rows={4}
              defaultValue={form?.embedHtml ?? ""}
              placeholder={'<iframe src="…" width="640" height="480"></iframe>'}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Optional — paste the full &lt;iframe&gt; embed code from Google
              or Microsoft Forms. Falls back to the form URL above.
            </p>
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
              {busy ? "Saving…" : isEdit ? "Save changes" : "Publish form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isEdit ? "Save changes?" : "Publish this form?"}
        description={
          isEdit
            ? "The updated details will be saved for this form link."
            : "The form link will be added to the Forms page."
        }
        confirmLabel={isEdit ? "Save changes" : "Publish form"}
        onConfirm={runSave}
      />
    </Dialog>
  );
}

/** Admin view to add, edit, and remove the form links shown publicly. */
export function FormsAdminView({ forms }: { forms: AdminForm[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        subtitle="Manage the forms shown on the public Forms page."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New form
          </Button>
        }
      />

      {forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms"
          body="Add a form to get started."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <FormRow key={form.id} form={form} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
