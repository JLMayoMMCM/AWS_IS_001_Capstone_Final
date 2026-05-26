import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { adminListBlogs } from "@/lib/queries";
import { BlogApprovalList } from "./blog-approval-list";

export const metadata: Metadata = { title: "Blogs" };

export default async function AdminBlogApprovalPage() {
  const [pending, approved, rejected, archived] = await Promise.all([
    adminListBlogs("pending"),
    adminListBlogs("approved"),
    adminListBlogs("rejected"),
    adminListBlogs("archived"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blogs"
        subtitle="Review submitted posts and manage their lifecycle."
      />
      <BlogApprovalList
        pending={pending}
        approved={approved}
        rejected={rejected}
        archived={archived}
      />
    </div>
  );
}
