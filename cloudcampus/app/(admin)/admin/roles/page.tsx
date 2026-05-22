import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { listMembers } from "@/lib/queries";
import { RolesView } from "./roles-view";

export const metadata: Metadata = { title: "Roles" };

export default async function AdminRolesPage() {
  const [members, session] = await Promise.all([listMembers(), getSession()]);
  const admins = members.filter((m) => m.role === "admin");
  const others = members.filter((m) => m.role !== "admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        subtitle="Grant or revoke administrator access. Approver positions are managed under Officers."
      />
      <RolesView
        admins={admins}
        members={others}
        currentMemberId={session.memberId}
      />
    </div>
  );
}
