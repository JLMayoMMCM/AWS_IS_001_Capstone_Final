"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  MoreVertical,
  Pencil,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/cloudcampus/confirm-dialog";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { Member } from "@/lib/types";

/** Dialog for editing a member's directory record (FR-ADM-02). */
function EditMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: Member;
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

  async function runSave() {
    const form = pendingForm.current;
    if (!form) return;
    setBusy(true);
    const yearValue = form.get("year");
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          studentId: form.get("studentId"),
          course: form.get("course"),
          year: yearValue ? Number(yearValue) : null,
          contactEmail: form.get("contactEmail"),
          bio: form.get("bio"),
          status: form.get("status"),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not update the member.");
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
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>
            Update {member.name}&rsquo;s directory record.
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
            <Label htmlFor={`edit-name-${member.id}`}>Full name</Label>
            <Input
              id={`edit-name-${member.id}`}
              name="name"
              defaultValue={member.name}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-sid-${member.id}`}>Student ID</Label>
              <Input
                id={`edit-sid-${member.id}`}
                name="studentId"
                defaultValue={member.studentId ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-status-${member.id}`}>Status</Label>
              <NativeSelect
                id={`edit-status-${member.id}`}
                name="status"
                defaultValue={member.status}
                className="w-full"
              >
                <NativeSelectOption value="Active">Active</NativeSelectOption>
                <NativeSelectOption value="For Renewal">
                  For Renewal
                </NativeSelectOption>
                <NativeSelectOption value="Inactive">
                  Inactive
                </NativeSelectOption>
                <NativeSelectOption value="Alumni">Alumni</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-course-${member.id}`}>Course</Label>
              <Input
                id={`edit-course-${member.id}`}
                name="course"
                defaultValue={member.course ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-year-${member.id}`}>Year level</Label>
              <NativeSelect
                id={`edit-year-${member.id}`}
                name="year"
                defaultValue={member.year ? String(member.year) : ""}
                className="w-full"
              >
                <NativeSelectOption value="">Not set</NativeSelectOption>
                <NativeSelectOption value="1">Year 1</NativeSelectOption>
                <NativeSelectOption value="2">Year 2</NativeSelectOption>
                <NativeSelectOption value="3">Year 3</NativeSelectOption>
                <NativeSelectOption value="4">Year 4</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-email-${member.id}`}>Contact email</Label>
            <Input
              id={`edit-email-${member.id}`}
              name="contactEmail"
              type="email"
              defaultValue={member.email ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-bio-${member.id}`}>Bio</Label>
            <Textarea
              id={`edit-bio-${member.id}`}
              name="bio"
              rows={3}
              defaultValue={member.bio ?? ""}
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
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save member changes?"
        description={`${member.name}’s directory record will be updated.`}
        confirmLabel="Save changes"
        onConfirm={runSave}
      />
    </Dialog>
  );
}

/** Dialog for setting a new password on a member's account (FR-ADM-02). */
function ResetPasswordDialog({
  member,
  open,
  onOpenChange,
}: {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingForm = useRef<FormData | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    pendingForm.current = new FormData(event.currentTarget);
    setConfirmOpen(true);
  }

  async function runReset() {
    const form = pendingForm.current;
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.get("password") }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not reset the password.");
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
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {member.name}. Share it with them; they
            should change it after signing in.
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
            <Label htmlFor={`reset-pw-${member.id}`}>New password</Label>
            <Input
              id={`reset-pw-${member.id}`}
              name="password"
              type="text"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
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
              {busy ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reset this password?"
        description={`${member.name}’s current password will stop working immediately.`}
        confirmLabel="Reset password"
        confirmVariant="destructive"
        onConfirm={runReset}
      />
    </Dialog>
  );
}

function MemberRow({
  member,
  isSelf,
}: {
  member: Member;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmRole, setConfirmRole] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const isAdmin = member.role === "admin";
  const isInactive = member.status === "Inactive";

  async function toggleRole() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin: !isAdmin }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: isInactive }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <UserAvatar name={member.name} memberId={member.id} size="xs" />
          <div>
            <div className="font-medium">{member.name}</div>
            <div className="text-xs text-muted-foreground">
              {member.course ?? "—"}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {member.email ?? "—"}
      </TableCell>
      <TableCell>
        <Badge variant={isAdmin ? "default" : "secondary"}>
          {isAdmin ? "Admin" : "Member"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={member.status === "Active" ? "secondary" : "outline"}>
          {member.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {/* modal={false}: the menu must not leave a body lock behind when a
            dialog opens from one of its items. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`Actions for ${member.name}`}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setResetOpen(true)}>
              <KeyRound /> Reset password
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setConfirmRole(true)}
              disabled={isAdmin && isSelf}
            >
              <ShieldCheck /> {isAdmin ? "Revoke admin" : "Promote to admin"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmStatus(true)}
              disabled={isSelf}
            >
              {isInactive ? <UserCheck /> : <UserX />}
              {isInactive ? "Reactivate" : "Deactivate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <EditMemberDialog
          member={member}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
        <ResetPasswordDialog
          member={member}
          open={resetOpen}
          onOpenChange={setResetOpen}
        />
        <ConfirmDialog
          open={confirmRole}
          onOpenChange={setConfirmRole}
          title={isAdmin ? "Revoke admin access?" : "Promote to admin?"}
          description={
            isAdmin
              ? `${member.name} will lose administrator access and return to a regular member account.`
              : `${member.name} will gain full administrator access — managing members, content and roles.`
          }
          confirmLabel={isAdmin ? "Revoke admin" : "Promote"}
          confirmVariant={isAdmin ? "destructive" : "default"}
          onConfirm={toggleRole}
        />
        <ConfirmDialog
          open={confirmStatus}
          onOpenChange={setConfirmStatus}
          title={
            isInactive ? "Reactivate this member?" : "Deactivate this member?"
          }
          description={
            isInactive
              ? `${member.name} will be marked active and able to sign in again.`
              : `${member.name} will be marked inactive and blocked from signing in.`
          }
          confirmLabel={isInactive ? "Reactivate" : "Deactivate"}
          confirmVariant={isInactive ? "default" : "destructive"}
          onConfirm={toggleStatus}
        />
      </TableCell>
    </TableRow>
  );
}

function RegisterDialog({
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

  async function runRegister() {
    const form = pendingForm.current;
    if (!form) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          fullName: form.get("fullName"),
          password: form.get("password"),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not register the member.");
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
          <DialogTitle>Register a member</DialogTitle>
          <DialogDescription>
            Creates a login and profile. Share the initial password with the
            member; they should change it after first sign-in.
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
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Initial password</Label>
            <Input
              id="password"
              name="password"
              type="text"
              minLength={8}
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
              {busy ? "Registering…" : "Register member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Register this member?"
        description="A login and profile will be created. Share the initial password with the member so they can sign in."
        confirmLabel="Register member"
        onConfirm={runRegister}
      />
    </Dialog>
  );
}

export function MembersAdminView({
  members,
  currentMemberId,
}: {
  members: Member[];
  currentMemberId: string | null;
}) {
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="The directory, account roles, and member records."
        actions={
          <Button onClick={() => setRegisterOpen(true)}>
            <UserPlus /> Register member
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No members yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isSelf={member.id === currentMemberId}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} />
    </div>
  );
}
