import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import {
  listMembers,
  listOfficers,
  listPositions,
  listSchoolYears,
} from "@/lib/queries";
import { OfficersAdminView } from "./officers-admin-view";

export const metadata: Metadata = { title: "Officers" };

export default async function AdminOfficersPage() {
  const [positions, officers, members, schoolYears] = await Promise.all([
    listPositions(),
    listOfficers(),
    listMembers(),
    listSchoolYears(),
  ]);
  const currentSchoolYear = schoolYears.find((s) => s.isCurrent) ?? null;

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
        schoolYears={schoolYears}
        currentSchoolYearId={currentSchoolYear?.id ?? ""}
      />
    </div>
  );
}
