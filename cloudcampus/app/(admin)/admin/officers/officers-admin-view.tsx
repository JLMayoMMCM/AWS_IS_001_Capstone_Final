"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, TriangleAlert, UserPlus, Users } from "lucide-react";

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
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { Member, OfficerSummary, SchoolYear } from "@/lib/types";

interface Position {
  id: string;
  name: string;
  order: number;
  isApprover: boolean;
  maxIncumbents: number;
}

/** Dialog for assigning a member to an officer position (FR-ADM-04). */
function AssignOfficerDialog({
  open,
  onOpenChange,
  positions,
  members,
  schoolYears,
  currentSchoolYearId,
  officers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: Position[];
  members: Member[];
  schoolYears: SchoolYear[];
  currentSchoolYearId: string;
  officers: OfficerSummary[];
}) {
  const router = useRouter();
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

  async function runAssign() {
    const form = pendingForm.current;
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/officers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: form.get("memberId"),
          positionId: form.get("positionId"),
          schoolYearId: form.get("schoolYearId"),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not assign the officer.");
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
          <DialogTitle>Assign an officer</DialogTitle>
          <DialogDescription>
            Give a member an officer position for a school year.
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
            <Label htmlFor="officer-member">Member</Label>
            <NativeSelect
              id="officer-member"
              name="memberId"
              required
              defaultValue=""
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select a member
              </NativeSelectOption>
              {members.map((member) => (
                <NativeSelectOption key={member.id} value={member.id}>
                  {member.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="officer-position">Position</Label>
            <NativeSelect
              id="officer-position"
              name="positionId"
              required
              defaultValue=""
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select a position
              </NativeSelectOption>
              {positions.map((position) => {
                const filledCount = officers.filter(
                  (o) =>
                    o.position === position.name &&
                    o.schoolYearId === currentSchoolYearId,
                ).length;
                const atCap = filledCount >= position.maxIncumbents;
                return (
                  <NativeSelectOption
                    key={position.id}
                    value={position.id}
                    disabled={atCap}
                  >
                    {position.name}
                    {` (${filledCount}/${position.maxIncumbents}${
                      atCap ? " — full" : ""
                    })`}
                  </NativeSelectOption>
                );
              })}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Each position has a capacity set in Admin → Positions. Positions
              at capacity for the current school year are disabled.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="officer-school-year">School year</Label>
            <NativeSelect
              id="officer-school-year"
              name="schoolYearId"
              required
              defaultValue={currentSchoolYearId}
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                Select a school year
              </NativeSelectOption>
              {schoolYears.map((sy) => (
                <NativeSelectOption key={sy.id} value={sy.id}>
                  {sy.label}
                  {sy.isCurrent ? " (current)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
              {busy ? "Assigning…" : "Assign officer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Assign this officer?"
        description="The member is given this position for the school year. If the position already has an officer, their term is ended and they move to past officers."
        confirmLabel="Assign officer"
        onConfirm={runAssign}
      />
    </Dialog>
  );
}

/** Dialog for adding a new officer position. */
function AddPositionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
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

  async function runAdd() {
    const form = pendingForm.current;
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not add the position.");
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
          <DialogTitle>Add a position</DialogTitle>
          <DialogDescription>
            Create a new officer position for the roster.
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
            <Label htmlFor="position-name">Position name</Label>
            <Input id="position-name" name="name" required />
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
              {busy ? "Adding…" : "Add position"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Add this position?"
        description="The position is added to the roster and can be assigned to a member."
        confirmLabel="Add position"
        onConfirm={runAdd}
      />
    </Dialog>
  );
}

/** One row of the current-officers roster, with a Remove action. */
function OfficerRow({ officer }: { officer: OfficerSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/officers/${officer.id}`, {
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
          <UserAvatar name={officer.name} size="xs" />
          {officer.name}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          {officer.position}
          {officer.isApprover && <Badge variant="outline">Approver</Badge>}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{officer.term}</TableCell>
      <TableCell className="text-right">
        <ConfirmButton
          variant="destructive"
          size="sm"
          disabled={busy}
          title="Remove this officer?"
          description={`${officer.name} will be removed as ${officer.position} and moved to past officers.`}
          confirmLabel="Remove"
          confirmVariant="destructive"
          onConfirm={remove}
        >
          Remove
        </ConfirmButton>
      </TableCell>
    </TableRow>
  );
}

export function OfficersAdminView({
  positions,
  officers,
  members,
  schoolYears,
  currentSchoolYearId,
}: {
  positions: Position[];
  officers: OfficerSummary[];
  members: Member[];
  schoolYears: SchoolYear[];
  currentSchoolYearId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);

  async function toggleApprover(positionId: string) {
    setBusyId(positionId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/positions/${positionId}/approver`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not update the position.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePosition(positionId: string) {
    setBusyId(positionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/positions/${positionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not delete the position.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <h2 className="text-lg font-semibold">Positions</h2>
            <p className="text-xs text-muted-foreground">
              Exactly three positions must be approvers.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddPositionOpen(true)}>
            <Plus /> Add position
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {positions.map((position) => (
            <div
              key={position.id}
              className="space-y-2 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{position.name}</span>
                {position.isApprover && (
                  <Badge variant="outline">
                    <ShieldCheck /> Approver
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <ConfirmButton
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={busyId === position.id}
                  title={
                    position.isApprover
                      ? "Remove approver status?"
                      : "Make this an approver position?"
                  }
                  description={
                    position.isApprover
                      ? `“${position.name}” will no longer vote on event approvals. Exactly three positions must stay approvers.`
                      : `“${position.name}” will be able to vote on event approvals. Exactly three positions must be approvers.`
                  }
                  confirmLabel={
                    position.isApprover ? "Remove approver" : "Make approver"
                  }
                  onConfirm={() => toggleApprover(position.id)}
                >
                  {position.isApprover ? "Remove approver" : "Make approver"}
                </ConfirmButton>
                <ConfirmButton
                  variant="destructive"
                  size="sm"
                  disabled={busyId === position.id}
                  title="Delete this position?"
                  description={`“${position.name}” will be removed. Approver positions and positions with officer history cannot be deleted.`}
                  confirmLabel="Delete"
                  confirmVariant="destructive"
                  onConfirm={() => deletePosition(position.id)}
                >
                  Delete
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Current officers</h2>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <UserPlus /> Assign officer
          </Button>
        </div>
        {officers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No officers assigned"
            body="Assign a member to a position to build the roster."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>School year</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {officers.map((officer) => (
                  <OfficerRow key={officer.id} officer={officer} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AddPositionDialog
        open={addPositionOpen}
        onOpenChange={setAddPositionOpen}
      />

      <AssignOfficerDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        positions={positions}
        members={members}
        schoolYears={schoolYears}
        currentSchoolYearId={currentSchoolYearId}
        officers={officers}
      />
    </div>
  );
}
