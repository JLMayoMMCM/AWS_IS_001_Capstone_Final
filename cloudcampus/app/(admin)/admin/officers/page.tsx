import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import {
  getOrg,
  listMembers,
  listOfficers,
  listPositions,
} from "@/lib/queries";
import { OfficersAdminView } from "./officers-admin-view";

export const metadata: Metadata = { title: "Officers" };

export default async function AdminOfficersPage() {
  const [positions, officers, members, org] = await Promise.all([
    listPositions(),
    listOfficers(),
    listMembers(),
    getOrg(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Officers"
        subtitle="Assign officer positions, manage which positions approve events, and review the roster."
      />
      <OfficersAdminView
        positions={positions}
        officers={officers}
        members={members}
        term={org.term}
      />
    </div>
  );
}
