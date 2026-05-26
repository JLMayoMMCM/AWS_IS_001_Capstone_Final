"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { OfficerCard } from "@/components/cloudcampus/officer-card";
import { PageHeader } from "@/components/cloudcampus/page-header";
import type { OfficerSummary, SchoolYear } from "@/lib/types";

export function OfficersView({
  officers,
  schoolYears,
  selectedSchoolYearId,
}: {
  officers: OfficerSummary[];
  schoolYears: SchoolYear[];
  selectedSchoolYearId: string;
}) {
  const router = useRouter();
  const selected =
    schoolYears.find((s) => s.id === selectedSchoolYearId) ?? null;
  const label = selected?.label ?? "—";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Officers"
        subtitle={`Roster for ${label}`}
        actions={
          <NativeSelect
            value={selectedSchoolYearId}
            onChange={(e) => router.push(`/officers?sy=${e.target.value}`)}
            aria-label="School year"
          >
            {schoolYears.map((sy) => (
              <NativeSelectOption key={sy.id} value={sy.id}>
                {sy.label}
                {sy.isCurrent ? " (current)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      />

      {officers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {officers.map((officer) => (
            <OfficerCard key={officer.id} officer={officer} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No officer records for this term"
          body="Pick another school year, or check back later."
        />
      )}
    </div>
  );
}
