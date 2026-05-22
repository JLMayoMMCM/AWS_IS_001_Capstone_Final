import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Newspaper,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { formatDate } from "@/lib/format";
import { getDashboardStats, listAuditEntries } from "@/lib/queries";

export const metadata: Metadata = { title: "Admin dashboard" };

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-1 text-3xl font-bold tracking-[-0.02em]">{value}</div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const [stats, recent] = await Promise.all([
    getDashboardStats(),
    listAuditEntries(8),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="An overview of what is happening across CloudCampus."
      />

      {stats.vacantApproverPositions.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {stats.vacantApproverPositions.join(", ")} vacant
          </AlertTitle>
          <AlertDescription>
            Events cannot be fully approved until every approver position is
            filled. Assign an officer in{" "}
            <Link href="/admin/officers">Officers</Link>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active members"
          value={stats.activeMembers}
          icon={Users}
          href="/admin/members"
        />
        <StatCard
          label="Pending blogs"
          value={stats.pendingBlogs}
          icon={Newspaper}
          href="/admin/blogs/approval"
        />
        <StatCard
          label="Pending projects"
          value={stats.pendingProjects}
          icon={Briefcase}
          href="/admin/projects"
        />
        <StatCard
          label="Pending events"
          value={stats.pendingEvents}
          icon={CalendarDays}
          href="/admin/events"
        />
      </div>

      <section className="rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4" /> Recent activity
        </h2>
        {recent.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No recorded activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-3">
                <UserAvatar name={entry.actorName} size="xs" />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{entry.actorName}</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.action}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    on {entry.entity}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(entry.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="pt-3">
          <Link
            href="/admin/audit"
            className="rounded-sm text-sm text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            View full audit log →
          </Link>
        </div>
      </section>
    </div>
  );
}
