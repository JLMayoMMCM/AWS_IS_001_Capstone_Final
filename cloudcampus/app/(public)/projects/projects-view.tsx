"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { ProjectCard } from "@/components/cloudcampus/project-card";
import { SearchInput } from "@/components/cloudcampus/search-input";
import { useSession } from "@/components/cloudcampus/session-provider";
import type { Project } from "@/lib/types";

export function ProjectsView({
  projects,
  canUpload = false,
}: {
  projects: Project[];
  canUpload?: boolean;
}) {
  const { role } = useSession();
  const isGuest = role === "guest";

  const [query, setQuery] = useState("");
  const [tech, setTech] = useState("");

  const allTech = useMemo(
    () => Array.from(new Set(projects.flatMap((p) => p.stack))).sort(),
    [projects],
  );

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q);
      const matchesTech = !tech || p.stack.includes(tech);
      return matchesQuery && matchesTech;
    });
  }, [projects, query, tech]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Projects" subtitle="Built by members of CloudCampus" />
        {canUpload && (
          <Button asChild>
            <Link href="/projects/new">
              <Upload /> Upload project
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search projects…"
          className="md:max-w-md md:flex-1"
        />
        <NativeSelect
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          aria-label="Filter by technology"
          className="md:w-48"
        >
          <NativeSelectOption value="">All technologies</NativeSelectOption>
          {allTech.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {t}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No projects yet"
          body="No projects match your filters."
          cta={
            !isGuest ? (
              <Button asChild>
                <Link href="/projects/new">Submit a project</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
