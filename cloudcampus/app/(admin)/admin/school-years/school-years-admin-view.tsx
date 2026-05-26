"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, Star, Trash2, TriangleAlert } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmButton } from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { formatDate } from "@/lib/format";
import type { SchoolYear } from "@/lib/types";

export function SchoolYearsAdminView({
  schoolYears,
}: {
  schoolYears: SchoolYear[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setCurrent(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/school-years/${id}/current`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not promote the school year.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteYear(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/school-years/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete the school year.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New school year
        </Button>
      </div>

      {schoolYears.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No school years yet"
          body="Create one to anchor officers, members, and announcements."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schoolYears.map((sy) => (
                <TableRow key={sy.id}>
                  <TableCell className="font-medium">{sy.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(sy.startsOn)} – {formatDate(sy.endsOn)}
                  </TableCell>
                  <TableCell>
                    {sy.isCurrent ? (
                      <Badge>
                        <Star className="h-3 w-3" /> Current
                      </Badge>
                    ) : (
                      <Badge variant="outline">Past</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!sy.isCurrent && (
                        <ConfirmButton
                          size="sm"
                          variant="outline"
                          title="Promote to current?"
                          description={`${sy.label} becomes the current school year. Officers from the previous SY are archived and the current roster is snapshotted for history.`}
                          confirmLabel="Promote"
                          onConfirm={() => setCurrent(sy.id)}
                          disabled={busyId === sy.id}
                        >
                          <Star className="h-4 w-4" /> Set current
                        </ConfirmButton>
                      )}
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        title="Delete school year?"
                        description="Only school years without officers can be deleted."
                        confirmLabel="Delete"
                        confirmVariant="destructive"
                        onConfirm={() => deleteYear(sy.id)}
                        disabled={busyId === sy.id || sy.isCurrent}
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const startYear = Number(form.get("startYear"));
    if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2200) {
      setError("Enter a valid start year.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/school-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startYear }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not create the school year.");
        setBusy(false);
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New school year</DialogTitle>
          <DialogDescription>
            Enter the start year; the end year is automatically the next year.
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
            <Label htmlFor="startYear">Start year</Label>
            <Input
              id="startYear"
              name="startYear"
              type="number"
              min={1900}
              max={2200}
              defaultValue={new Date().getFullYear()}
              required
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
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
