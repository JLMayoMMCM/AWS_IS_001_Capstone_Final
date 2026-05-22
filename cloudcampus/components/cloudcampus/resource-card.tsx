import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ResourceIcon } from "@/components/cloudcampus/resource-icon";
import type { ResourceItem } from "@/lib/types";

/**
 * Resource list row (WIRE §5.9): file-type icon, title, description, and
 * type/size metadata. The whole card links to the resource detail page, which
 * carries the download action.
 */
export function ResourceCard({ resource }: { resource: ResourceItem }) {
  return (
    <Link
      href={`/resources/${resource.id}`}
      className="group flex items-start gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        aria-hidden
      >
        <ResourceIcon type={resource.type} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-semibold leading-tight">
            {resource.title}
          </h3>
          {resource.visibility === "private" && (
            <Badge variant="outline" className="shrink-0">
              Members only
            </Badge>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
          {resource.description}
        </p>
        <p className="mt-2 font-mono text-xs uppercase text-muted-foreground">
          {resource.type} · {resource.size}
        </p>
      </div>
    </Link>
  );
}
