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
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { BlogPost } from "@/lib/types";

type Status = "pending" | "approved" | "rejected" | "archived";

interface Action {
  label: string;
  status: "approved" | "rejected" | "archived";
  variant: "default" | "destructive";
  icon: typeof Check;
}

const CONFIRM: Record<
  Action["status"],
  { title: string; body: (title: string) => string }
> = {
  approved: {
    title: "Approve this post?",
    body: (t) => `“${t}” will be published and visible to readers.`,
  },
  rejected: {
    title: "Reject this post?",
    body: (t) =>
      `“${t}” will be rejected and stay hidden. The author can revise and resubmit it.`,
  },
  archived: {
    title: "Archive this post?",
    body: (t) =>
      `“${t}” will be moved to the archive and removed from the blogs page.`,
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

function BlogRow({ blog, actions }: { blog: BlogPost; actions: Action[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: Action["status"]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/blogs/${blog.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Could not update the post.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <div>
        <h3 className="text-lg font-semibold leading-tight">{blog.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <UserAvatar name={blog.author} size="xs" />
          <span>
            {blog.author} · submitted {blog.dateLabel}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {blog.excerpt}
      </p>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/blogs/${blog.slug}`} target="_blank">
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
            description={CONFIRM[action.status].body(blog.title)}
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

export function BlogApprovalList({
  pending,
  approved,
  rejected,
  archived,
}: {
  pending: BlogPost[];
  approved: BlogPost[];
  rejected: BlogPost[];
  archived: BlogPost[];
}) {
  const [tab, setTab] = useState<Status>("pending");
  const groups: Record<Status, BlogPost[]> = {
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
        <EmptyState icon={Inbox} title={`No ${tab} blogs`} />
      ) : (
        <div className="space-y-4">
          {items.map((blog) => (
            <BlogRow key={blog.id} blog={blog} actions={ACTIONS[tab]} />
          ))}
        </div>
      )}
    </div>
  );
}
