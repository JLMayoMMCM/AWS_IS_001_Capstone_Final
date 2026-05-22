import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PlaceholderImage } from "@/components/cloudcampus/placeholder-image";
import type { BlogPost } from "@/lib/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Cover-image blog card used on the welcome page's "Latest from the blog" grid
 * (WIRE §5.1). Shows author, date, and a Private badge for member-only posts.
 *
 * Uses a plain card surface (not shadcn `Card`) so the cover image can sit
 * flush to the top edge — the radix-maia `Card` bakes in vertical padding.
 */
export function BlogPreviewCard({ blog }: { blog: BlogPost }) {
  return (
    <Link
      href={`/blogs/${blog.slug}`}
      className="group block overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {blog.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blog.coverUrl}
          alt={blog.coverAlt}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <PlaceholderImage alt={blog.coverAlt} aspect="aspect-video" />
      )}
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-xl font-semibold leading-tight">
          {blog.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {blog.excerpt}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">
              {initials(blog.author)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {blog.author} · {blog.dateLabel}
          </span>
          {blog.visibility === "private" && (
            <Badge variant="outline" className="ml-auto">
              Private
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
