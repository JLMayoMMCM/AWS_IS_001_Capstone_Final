"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MailOpen, TriangleAlert, X } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { formatDate } from "@/lib/format";
import type { RegistrationRequest } from "@/lib/types";

const STATUS_BADGE: Record<
  RegistrationRequest["status"],
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pending: { label: "Pending", variant: "default" },
  approved: { label: "Approved", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function RejectDialog({
  request,
  open,
  onOpenChange,
}: {
  request: RegistrationRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = (form.get("note") as string)?.trim();
    if (!note) {
      setError("A reason is required so the applicant knows why.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/registrations/${request.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not reject the request.");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject registration</DialogTitle>
          <DialogDescription>
            {request.fullName} ({request.email})
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
            <Label htmlFor="note">Reason</Label>
            <Textarea id="note" name="note" rows={4} required />
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
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegistrationsAdminView({
  requests,
}: {
  requests: RegistrationRequest[];
}) {
  const router = useRouter();
  const [approveTarget, setApproveTarget] = useState<RegistrationRequest | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function runApprove(request: RegistrationRequest) {
    setBusyId(request.id);
    try {
      const res = await fetch(
        `/api/admin/registrations/${request.id}/approve`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        alert(data.error ?? "Could not approve the registration.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
      setApproveTarget(null);
    }
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={MailOpen}
        title="No registrations yet"
        body="Public applications appear here once submitted."
      />
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pending ({pending.length})
        </h2>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Course / Year</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No pending applications.
                  </TableCell>
                </TableRow>
              )}
              {pending.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[r.course, r.year ? `Year ${r.year}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectTarget(r)}
                        disabled={busyId === r.id}
                      >
                        <X className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setApproveTarget(r)}
                        disabled={busyId === r.id}
                      >
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h2>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[r.status].variant}>
                        {STATUS_BADGE[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.reviewedAt ? formatDate(r.reviewedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.rejectionNote ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve registration"
        description={
          approveTarget
            ? `Create an account for ${approveTarget.fullName} (${approveTarget.email})?`
            : ""
        }
        confirmLabel="Approve"
        onConfirm={async () => {
          if (approveTarget) await runApprove(approveTarget);
        }}
      />

      {rejectTarget && (
        <RejectDialog
          request={rejectTarget}
          open
          onOpenChange={(open) => !open && setRejectTarget(null)}
        />
      )}
    </div>
  );
}
