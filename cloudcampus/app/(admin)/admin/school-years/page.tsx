import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { listSchoolYears } from "@/lib/queries";
import { SchoolYearsAdminView } from "./school-years-admin-view";

export const metadata: Metadata = { title: "School years" };

export default async function AdminSchoolYearsPage() {
  const schoolYears = await listSchoolYears();
  return (
    <div className="space-y-6">
      <PageHeader
        title="School years"
        subtitle="The academic calendar — officers, members, and announcements are scoped per school year."
      />
      <SchoolYearsAdminView schoolYears={schoolYears} />
    </div>
  );
}
