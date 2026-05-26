import type { Metadata } from "next";

import { listOfficers, listSchoolYears } from "@/lib/queries";
import { OfficersView } from "./officers-view";

export const metadata: Metadata = {
  title: "Officers",
  description: "Meet the current CloudCampus officer team.",
};

interface PageProps {
  searchParams: Promise<{ sy?: string }>;
}

export default async function OfficersPage({ searchParams }: PageProps) {
  const { sy } = await searchParams;
  const schoolYears = await listSchoolYears();
  const current = schoolYears.find((s) => s.isCurrent) ?? schoolYears[0];
  const selectedId =
    sy && schoolYears.some((s) => s.id === sy) ? sy : current?.id ?? "";
  const officers = selectedId ? await listOfficers(selectedId) : [];
  return (
    <OfficersView
      officers={officers}
      schoolYears={schoolYears}
      selectedSchoolYearId={selectedId}
    />
  );
}
