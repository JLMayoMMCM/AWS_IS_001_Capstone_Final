"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  LOOKUP_KEYS,
  LOOKUP_LABELS,
  type LookupKey,
  type LookupRow,
} from "@/lib/lookups";

/**
 * Add/edit dialog for a single lookup value. Used for both creating a new
 * value (no `row`) and editing an existing one. Mirrors `UploadDialog`:
 * the form captures its data and opens a nested `ConfirmDialog` that replays
 * the request once the admin confirms.
 */
function CategoryDialog({
  open,
  onOpenChange,
  tableKey,
  tableLabel,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableKey: LookupKey;
  tableLabel: string;
  row?: LookupRow;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Form data captured at submit time, replayed once the admin confirms.
  const pendingForm = useRef<FormData | null>(null);
  const isEdit = Boolean(row);

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
      const res = await fetch(
        isEdit
          ? `/api/admin/lookups/${tableKey}/${row!.id}`
          : `/api/admin/lookups/${tableKey}`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name") }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not save the value.");
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
          <DialogTitle>
            {isEdit ? "Edit value" : `Add to ${tableLabel}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update this value in ${tableLabel}.`
              : `Add a new value to ${tableLabel}.`}
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
            <Label htmlFor="category-name">Value</Label>
            <Input
              id="category-name"
              name="name"
              required
              defaultValue={row?.name ?? ""}
            />
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
              {busy ? "Saving…" : isEdit ? "Save changes" : "Add value"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isEdit ? "Save changes?" : "Add this value?"}
        description={
          isEdit
            ? `This value in ${tableLabel} will be updated.`
            : `The value will be added to ${tableLabel}.`
        }
        confirmLabel={isEdit ? "Save changes" : "Add value"}
        onConfirm={runSave}
      />
    </Dialog>
  );
}

/** A single lookup row with edit and delete actions. */
function CategoryRow({
  row,
  tableKey,
  tableLabel,
}: {
  row: LookupRow;
  tableKey: LookupKey;
  tableLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/lookups/${tableKey}/${row.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
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
            title="Delete this value?"
            description={`“${row.name}” will be removed from ${tableLabel}. Anything currently using it keeps its data, but the reference is cleared.`}
            confirmLabel="Delete"
            confirmVariant="destructive"
            onConfirm={remove}
          >
            Delete
          </ConfirmButton>
        </div>
      </TableCell>
      <CategoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tableKey={tableKey}
        tableLabel={tableLabel}
        row={row}
      />
    </TableRow>
  );
}

/** Admin view for managing the lookup tables used across CloudCampus. */
export function CategoriesView({
  tables,
}: {
  tables: Record<LookupKey, LookupRow[]>;
}) {
  const [selected, setSelected] = useState<LookupKey>(LOOKUP_KEYS[0]);
  const [addOpen, setAddOpen] = useState(false);

  const rows = tables[selected];
  const label = LOOKUP_LABELS[selected];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle="Manage the lookup values used across CloudCampus."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus /> Add value
          </Button>
        }
      />

      <div className="space-y-1.5">
        <Label htmlFor="category-table">Table</Label>
        <NativeSelect
          id="category-table"
          value={selected}
          onChange={(event) => setSelected(event.target.value as LookupKey)}
        >
          {LOOKUP_KEYS.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {LOOKUP_LABELS[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No values"
          body="Add a value to get started."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <CategoryRow
                  key={row.id}
                  row={row}
                  tableKey={selected}
                  tableLabel={label}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CategoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tableKey={selected}
        tableLabel={label}
      />
    </div>
  );
}
