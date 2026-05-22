import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { adminListBlogs } from "@/lib/queries";
import { BlogApprovalList } from "./blog-approval-list";

export const metadata: Metadata = { title: "Blog approvals" };

export default async function AdminBlogApprovalPage() {
  const blogs = await adminListBlogs("pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog approvals"
        subtitle="Posts submitted by members, awaiting review."
      />
      <BlogApprovalList blogs={blogs} />
    </div>
  );
}
