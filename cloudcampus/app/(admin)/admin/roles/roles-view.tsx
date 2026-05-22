"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmButton } from "@/components/cloudcampus/confirm-dialog";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { Member } from "@/lib/types";

function RoleButton({
  member,
  makeAdmin,
  disabled,
}: {
  member: Member;
  makeAdmin: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin: makeAdmin }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmButton
      variant={makeAdmin ? "outline" : "destructive"}
      size="sm"
      disabled={busy || disabled}
      title={makeAdmin ? "Promote to admin?" : "Revoke admin access?"}
      description={
        makeAdmin
          ? `${member.name} will gain full administrator access — managing members, content and roles.`
          : `${member.name} will lose administrator access and return to a regular member account.`
      }
      confirmLabel={makeAdmin ? "Promote" : "Revoke admin"}
      confirmVariant={makeAdmin ? "default" : "destructive"}
      onConfirm={toggle}
    >
      {makeAdmin ? "Promote to admin" : "Revoke admin"}
    </ConfirmButton>
  );
}

function MemberTable({
  rows,
  makeAdmin,
  currentMemberId,
}: {
  rows: Member[];
  makeAdmin: boolean;
  currentMemberId: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                No one to show.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <UserAvatar name={member.name} size="xs" />
                    {member.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <RoleButton
                    member={member}
                    makeAdmin={makeAdmin}
                    disabled={!makeAdmin && member.id === currentMemberId}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function RolesView({
  admins,
  members,
  currentMemberId,
}: {
  admins: Member[];
  members: Member[];
  currentMemberId: string | null;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Administrators</h2>
        <MemberTable
          rows={admins}
          makeAdmin={false}
          currentMemberId={currentMemberId}
        />
        <p className="text-xs text-muted-foreground">
          You cannot revoke your own admin role.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <MemberTable
          rows={members}
          makeAdmin
          currentMemberId={currentMemberId}
        />
      </section>
    </div>
  );
}
