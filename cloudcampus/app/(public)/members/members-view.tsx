"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { SearchInput } from "@/components/cloudcampus/search-input";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { useSession } from "@/components/cloudcampus/session-provider";
import type { Member } from "@/lib/types";

const PER_PAGE = 9;

function yearLabel(member: Member) {
  if (member.status === "Alumni") return "Alumni";
  return member.year ? `Year ${member.year}` : "Member";
}

export function MembersView({ members }: { members: Member[] }) {
  const { role } = useSession();
  const isGuest = role === "guest";
  const activeCount = members.filter((m) => m.status === "Active").length;

  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.course ?? "").toLowerCase().includes(q);
      const matchesYear = !year || String(m.year) === year;
      return matchesQuery && matchesYear;
    });
  }, [members, query, year]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (current - 1) * PER_PAGE,
    current * PER_PAGE,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Members" subtitle={`${activeCount} active members`} />

      {isGuest && (
        <Alert>
          <Lock />
          <AlertDescription>
            Log in to view full member profiles. Public listings show name and
            course only.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 md:flex-row">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search members…"
          className="md:max-w-md md:flex-1"
        />
        <NativeSelect
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by year level"
          className="md:w-48"
        >
          <NativeSelectOption value="">All year levels</NativeSelectOption>
          <NativeSelectOption value="1">Year 1</NativeSelectOption>
          <NativeSelectOption value="2">Year 2</NativeSelectOption>
          <NativeSelectOption value="3">Year 3</NativeSelectOption>
          <NativeSelectOption value="4">Year 4</NativeSelectOption>
        </NativeSelect>
      </div>

      {pageItems.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members match your search"
          body="Try a different name, course, or year level."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((member) => {
            const body = (
              <>
                <UserAvatar
                  name={member.name}
                  memberId={member.id}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">
                    {member.name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[member.course, yearLabel(member)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {!isGuest && member.email && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  )}
                </div>
                {!isGuest && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </>
            );

            return isGuest ? (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10"
              >
                {body}
              </div>
            ) : (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="flex items-center gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {body}
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-1"
          aria-label="Members pagination"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              variant={n === current ? "default" : "ghost"}
              size="sm"
              aria-current={n === current ? "page" : undefined}
              onClick={() => setPage(n)}
            >
              {n}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={current >= totalPages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
