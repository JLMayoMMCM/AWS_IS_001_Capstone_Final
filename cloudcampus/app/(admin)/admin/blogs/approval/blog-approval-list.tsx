"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Inbox, TriangleAlert, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/cloudcampus/confirm-dialog";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { BlogPost } from "@/lib/types";

function BlogRow({ blog }: { blog: BlogPost }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: "approved" | "rejected") {
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
        <ConfirmButton
          variant="destructive"
          size="sm"
          disabled={busy}
          title="Reject this post?"
          description={`“${blog.title}” will be rejected and stay hidden. The author can revise and resubmit it.`}
          confirmLabel="Reject"
          confirmVariant="destructive"
          onConfirm={() => review("rejected")}
        >
          <X /> Reject
        </ConfirmButton>
        <ConfirmButton
          size="sm"
          disabled={busy}
          title="Approve this post?"
          description={`“${blog.title}” will be published and visible to readers.`}
          confirmLabel="Approve"
          onConfirm={() => review("approved")}
        >
          <Check /> Approve
        </ConfirmButton>
      </div>
    </div>
  );
}

export function BlogApprovalList({ blogs }: { blogs: BlogPost[] }) {
  if (blogs.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No pending blogs"
        body="Submitted posts awaiting review will appear here."
      />
    );
  }
  return (
    <div className="space-y-4">
      {blogs.map((blog) => (
        <BlogRow key={blog.id} blog={blog} />
      ))}
    </div>
  );
}
