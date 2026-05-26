import type { Metadata } from "next";
import { AlertOctagon, AlertTriangle, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { listAnnouncementsForViewer } from "@/lib/queries";

export const metadata: Metadata = { title: "Announcements" };

const LEVEL_ICON = {
  critical: AlertOctagon,
  elevated: AlertTriangle,
  normal: Megaphone,
} as const;

const LEVEL_TONE = {
  critical: "border-destructive/40 bg-destructive/5",
  elevated: "border-amber-400/40 bg-amber-50 dark:bg-amber-950/30",
  normal: "border-border bg-card",
} as const;

export default async function AnnouncementsPage() {
  const session = await getSession();
  const items = await listAnnouncementsForViewer(session);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="The latest updates from your officers."
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nothing to announce"
          body="Officers will post here when something needs everyone's attention."
        />
      ) : (
        <ul className="space-y-4">
          {items.map((a) => {
            const Icon = LEVEL_ICON[a.level];
            return (
              <li
                key={a.id}
                id={a.id}
                className={`rounded-xl border p-5 ${LEVEL_TONE[a.level]}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-1 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{a.title}</h2>
                      <Badge variant="secondary" className="uppercase">
                        {a.level}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {a.audience}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.authorName} · {formatDate(a.publishedAt)}
                    </p>
                    <div className="mt-3 space-y-2 text-sm leading-relaxed whitespace-pre-wrap">
                      {a.bodyMarkdown}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
