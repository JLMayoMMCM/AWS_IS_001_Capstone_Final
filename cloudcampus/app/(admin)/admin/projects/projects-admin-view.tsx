"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, Eye, Inbox, TriangleAlert, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmButton } from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import type { Project } from "@/lib/types";

type Status = "pending" | "approved" | "rejected" | "archived";

interface Action {
  label: string;
  status: "approved" | "rejected" | "archived";
  variant: "default" | "destructive";
  icon: typeof Check;
}

/** Confirmation copy for each review decision. */
const CONFIRM: Record<
  Action["status"],
  { title: string; body: (title: string) => string }
> = {
  approved: {
    title: "Approve this project?",
    body: (t) => `“${t}” will be published to the projects page.`,
  },
  rejected: {
    title: "Reject this project?",
    body: (t) =>
      `“${t}” will be rejected. The submitter can revise and resubmit it.`,
  },
  archived: {
    title: "Archive this project?",
    body: (t) =>
      `“${t}” will be moved to the archive and removed from the projects page.`,
  },
};

const ACTIONS: Record<Status, Action[]> = {
  pending: [
    { label: "Reject", status: "rejected", variant: "destructive", icon: X },
    { label: "Approve", status: "approved", variant: "default", icon: Check },
  ],
  approved: [
    { label: "Archive", status: "archived", variant: "destructive", icon: Archive },
  ],
  rejected: [
    { label: "Approve", status: "approved", variant: "default", icon: Check },
  ],
  archived: [],
};

function ProjectRow({ project, actions }: { project: Project; actions: Action[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: Action["status"]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not update the project.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const submitter =
    project.contributors.find((c) => c.roleOnProject === "Submitter") ??
    project.contributors[0];

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <div>
        <h3 className="text-lg font-semibold leading-tight">{project.title}</h3>
        {submitter && (
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted by {submitter.name}
          </p>
        )}
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {project.summary}
      </p>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${project.id}`} target="_blank">
            <Eye /> Preview
          </Link>
        </Button>
        <div className="flex-1" />
        {actions.map((action) => (
          <ConfirmButton
            key={action.status}
            variant={action.variant}
            size="sm"
            disabled={busy}
            title={CONFIRM[action.status].title}
            description={CONFIRM[action.status].body(project.title)}
            confirmLabel={action.label}
            confirmVariant={action.variant}
            onConfirm={() => review(action.status)}
          >
            <action.icon /> {action.label}
          </ConfirmButton>
        ))}
      </div>
    </div>
  );
}

export function ProjectsAdminView({
  pending,
  approved,
  rejected,
  archived,
}: {
  pending: Project[];
  approved: Project[];
  rejected: Project[];
  archived: Project[];
}) {
  const [tab, setTab] = useState<Status>("pending");
  const groups: Record<Status, Project[]> = {
    pending,
    approved,
    rejected,
    archived,
  };
  const items = groups[tab];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <EmptyState icon={Inbox} title={`No ${tab} projects`} />
      ) : (
        <div className="space-y-4">
          {items.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              actions={ACTIONS[tab]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
