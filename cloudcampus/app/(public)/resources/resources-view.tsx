"use client";

import { useMemo, useState } from "react";
import { Files } from "lucide-react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { ResourceCard } from "@/components/cloudcampus/resource-card";
import { SearchInput } from "@/components/cloudcampus/search-input";
import type { ResourceItem } from "@/lib/types";

export function ResourcesView({
  resources,
  categories,
}: {
  resources: ResourceItem[];
  categories: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      const matchesQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);
      const matchesCategory = !category || r.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [resources, query, category]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        subtitle="Downloadable templates, guides, and reference materials"
      />

      <div className="flex flex-col gap-2 md:flex-row">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search resources…"
          className="md:max-w-md md:flex-1"
        />
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="md:w-48"
        >
          <NativeSelectOption value="">All categories</NativeSelectOption>
          {categories.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Files}
          title="No resources match your filters"
          body="Try a different search term or category."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
}
