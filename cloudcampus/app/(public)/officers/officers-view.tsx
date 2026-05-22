"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { OfficerCard } from "@/components/cloudcampus/officer-card";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { pastTerms } from "@/lib/org";
import type { OfficerSummary } from "@/lib/types";

export function OfficersView({
  officers,
  currentTerm,
}: {
  officers: OfficerSummary[];
  currentTerm: string;
}) {
  const [term, setTerm] = useState(currentTerm);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Officers"
        subtitle={`Roster for ${term}`}
        actions={
          <NativeSelect
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Academic term"
          >
            {[currentTerm, ...pastTerms].map((t) => (
              <NativeSelectOption key={t} value={t}>
                {t}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      />

      {term === currentTerm && officers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {officers.map((officer) => (
            <OfficerCard key={officer.id} officer={officer} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No officer records for this term"
          body="Historical rosters are still being archived. Check back soon."
        />
      )}
    </div>
  );
}
