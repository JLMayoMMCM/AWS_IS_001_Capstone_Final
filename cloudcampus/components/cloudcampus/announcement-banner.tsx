import Link from "next/link";
import { AlertOctagon, AlertTriangle, Megaphone } from "lucide-react";

import { listAnnouncementsForViewer } from "@/lib/queries";
import { getSession } from "@/lib/auth";

/**
 * Site-wide announcement banner. Renders only critical/elevated items at the
 * top of the layout; the full list lives at /announcements.
 */
export async function AnnouncementBanner() {
  const session = await getSession();
  const items = await listAnnouncementsForViewer(session);
  const visible = items.filter(
    (a) => a.level === "critical" || a.level === "elevated",
  );
  if (visible.length === 0) return null;

  return (
    <aside className="border-b border-border bg-muted/60">
      <ul className="mx-auto max-w-7xl space-y-1 px-4 py-2 text-sm">
        {visible.slice(0, 3).map((a) => {
          const Icon =
            a.level === "critical" ? AlertOctagon : a.level === "elevated"
              ? AlertTriangle
              : Megaphone;
          const tone =
            a.level === "critical"
              ? "text-destructive"
              : a.level === "elevated"
                ? "text-amber-700 dark:text-amber-400"
                : "text-foreground";
          return (
            <li key={a.id} className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
              <Link
                href={`/announcements#${a.id}`}
                className={`hover:underline ${tone}`}
              >
                <strong>{a.title}</strong>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
