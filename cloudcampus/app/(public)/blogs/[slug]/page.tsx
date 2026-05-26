import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { ApprovalPanel } from "@/components/cloudcampus/approval-panel";
import { BackLink } from "@/components/cloudcampus/back-link";
import { BlogPreviewCard } from "@/components/cloudcampus/blog-preview-card";
import { PlaceholderImage } from "@/components/cloudcampus/placeholder-image";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { getSession } from "@/lib/auth";
import { getBlog, getRelatedBlogs } from "@/lib/queries";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getBlog(slug);
  return {
    title: blog ? blog.title : "Blog post",
    description: blog?.excerpt,
  };
}

export default async function BlogDetailPage({ params }: Params) {
  const { slug } = await params;
  const blog = await getBlog(slug);
  if (!blog) notFound();

  const session = await getSession();
  // Private posts are hidden from guests (FR-PUB-10).
  if (blog.visibility === "private" && session.role === "guest") {
    return <AccessDenied />;
  }

  const isAuthor = !!session.memberId && session.memberId === blog.authorId;
  const isOfficer = session.role === "officer" || session.role === "admin";
  // V2.1 §1.4: non-approved posts are only visible to the author + officers.
  if (blog.status !== "approved" && !isAuthor && !isOfficer) {
    return <AccessDenied />;
  }

  const related = await getRelatedBlogs(blog.id, session.role !== "guest");

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/blogs" label="Blog" />

      {blog.coverUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={blog.coverUrl}
          alt={blog.coverAlt}
          loading="lazy"
          className="aspect-video w-full rounded-xl object-cover ring-1 ring-foreground/10"
        />
      ) : (
        <PlaceholderImage
          alt={blog.coverAlt}
          aspect="aspect-video"
          className="rounded-xl ring-1 ring-foreground/10"
        />
      )}

      <header className="space-y-3">
        <h1 className="text-3xl font-bold leading-tight tracking-[-0.02em] md:text-4xl">
          {blog.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <UserAvatar name={blog.author} size="sm" />
          <span>{blog.author}</span>
          <span aria-hidden>·</span>
          <span>{blog.dateLabel}</span>
          {blog.visibility === "private" && (
            <Badge variant="outline">Private</Badge>
          )}
          {blog.status !== "approved" && (
            <Badge variant="secondary">{blog.status}</Badge>
          )}
        </div>
        {(isAuthor || session.role === "admin") &&
          blog.status !== "rejected" && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/blogs/${blog.slug}/edit`}>
                <Pencil />
                Edit
              </Link>
            </Button>
          )}
      </header>

      {isOfficer && blog.status === "pending" && (
        <ApprovalPanel entity="blog" id={blog.id} status={blog.status} />
      )}

      <div className="space-y-4 leading-relaxed text-foreground/90">
        {blog.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {blog.attachments.length > 0 && (
        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-xl font-semibold">Attachments</h2>
          {blog.attachments.some(
            (a) => a.kind === "image" && a.imageUrl,
          ) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {blog.attachments
                .filter((a) => a.kind === "image" && a.imageUrl)
                .map((a) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={a.id}
                    src={a.imageUrl ?? undefined}
                    alt={a.label}
                    loading="lazy"
                    className="w-full rounded-xl object-cover ring-1 ring-foreground/10"
                  />
                ))}
            </div>
          )}
          {blog.attachments.some((a) => a.kind === "link" && a.url) && (
            <ul className="space-y-2">
              {blog.attachments
                .filter((a) => a.kind === "link" && a.url)
                .map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      {a.label || a.url}
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-xl font-semibold">Related posts</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((b) => (
              <BlogPreviewCard key={b.id} blog={b} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
