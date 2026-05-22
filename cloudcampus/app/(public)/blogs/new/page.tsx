import type { Metadata } from "next";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { BackLink } from "@/components/cloudcampus/back-link";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { BlogForm } from "./blog-form";

export const metadata: Metadata = {
  title: "Submit a blog post",
};

export default async function NewBlogPage() {
  const session = await getSession();
  if (session.role === "guest") return <AccessDenied />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/blogs" label="Blog" />
      <PageHeader
        title="Submit a blog post"
        subtitle="Your post is reviewed by an admin before it is published."
      />
      <BlogForm />
    </div>
  );
}
