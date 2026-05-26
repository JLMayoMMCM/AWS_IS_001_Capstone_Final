import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { getBlog } from "@/lib/queries";
import { BlogForm } from "../../new/blog-form";

export const metadata: Metadata = { title: "Edit post" };

type Props = { params: Promise<{ slug: string }> };

/**
 * /blogs/[slug]/edit — the post's author (or an admin) re-opens an
 * already-submitted post for revisions. Saving returns it to the review
 * queue (V2.1 §1.2). Rejected posts are not editable.
 */
export default async function EditBlogPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  if (session.role === "guest" || !session.memberId) {
    return <AccessDenied />;
  }
  const blog = await getBlog(slug);
  if (!blog) notFound();

  const isAuthor = blog.authorId === session.memberId;
  if (!isAuthor && session.role !== "admin") return <AccessDenied />;
  if (blog.status === "rejected") {
    redirect(`/blogs/${slug}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Edit: ${blog.title}`}
        subtitle="Saving returns this post to the review queue."
      />
      <BlogForm existing={blog} />
    </div>
  );
}
