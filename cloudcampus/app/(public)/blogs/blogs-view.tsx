"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { BlogPreviewCard } from "@/components/cloudcampus/blog-preview-card";
import { EmptyState } from "@/components/cloudcampus/empty-state";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { useSession } from "@/components/cloudcampus/session-provider";
import type { BlogPost } from "@/lib/types";

type Sort = "latest" | "oldest";
type Vis = "all" | "public" | "private";

export function BlogsView({ blogs }: { blogs: BlogPost[] }) {
  const { role } = useSession();
  const isGuest = role === "guest";

  const [sort, setSort] = useState<Sort>("latest");
  const [vis, setVis] = useState<Vis>("all");

  const items = useMemo(() => {
    // Guests already receive only public posts from the server; members can
    // additionally narrow the list with the visibility toggle.
    const list =
      !isGuest && vis !== "all"
        ? blogs.filter((b) => b.visibility === vis)
        : blogs;
    return [...list].sort((a, b) =>
      sort === "latest"
        ? +new Date(b.date) - +new Date(a.date)
        : +new Date(a.date) - +new Date(b.date),
    );
  }, [blogs, isGuest, sort, vis]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        subtitle="Notes, recaps, and guides from members and officers"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isGuest && (
              <Button asChild>
                <Link href="/blogs/new">
                  <Plus /> Write a post
                </Link>
              </Button>
            )}
            <NativeSelect
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort posts"
            >
              <NativeSelectOption value="latest">
                Sort: Latest
              </NativeSelectOption>
              <NativeSelectOption value="oldest">
                Sort: Oldest
              </NativeSelectOption>
            </NativeSelect>
          </div>
        }
      />

      {!isGuest && (
        <ToggleGroup
          type="single"
          value={vis}
          onValueChange={(v) => v && setVis(v as Vis)}
          variant="outline"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="public">Public</ToggleGroupItem>
          <ToggleGroupItem value="private">Private</ToggleGroupItem>
        </ToggleGroup>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No posts yet"
          body="Once members publish, posts will appear here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {items.map((blog) => (
            <BlogPreviewCard key={blog.id} blog={blog} />
          ))}
        </div>
      )}
    </div>
  );
}
