import Link from "next/link";
import { ExternalLink, GitBranch, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/cloudcampus/avatar-stack";
import { PlaceholderImage } from "@/components/cloudcampus/placeholder-image";
import type { Project } from "@/lib/types";

/**
 * Project grid card (WIRE §5.11). The title is the primary link (a stretched
 * overlay makes the whole card clickable); the repo / live links sit above the
 * overlay so they stay independently clickable — valid, accessible nesting.
 */
export function ProjectCard({ project }: { project: Project }) {
  const visibleStack = project.stack.slice(0, 3);
  const overflow = project.stack.length - visibleStack.length;
  const contributorNames = project.contributors.map((c) => c.name);

  return (
    <div className="group relative overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-within:ring-2 focus-within:ring-ring">
      {project.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.coverUrl}
          alt={project.coverAlt}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <PlaceholderImage alt={project.coverAlt} aspect="aspect-video" />
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-xl font-semibold leading-tight">
            <Link
              href={`/projects/${project.id}`}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {project.title}
            </Link>
          </h3>
          {project.visibility === "private" && (
            <Badge variant="outline" className="shrink-0">
              <Lock /> Private
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {project.summary}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {project.category && (
            <Badge variant="secondary">{project.category}</Badge>
          )}
          {visibleStack.map((tech) => (
            <Badge key={tech} variant="secondary">
              {tech}
            </Badge>
          ))}
          {overflow > 0 && <Badge variant="outline">+{overflow}</Badge>}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <AvatarStack names={contributorNames} max={3} />
            <span className="text-xs text-muted-foreground">
              {contributorNames.length} contributor
              {contributorNames.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`${project.title} repository`}
                className="relative z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <GitBranch className="h-4 w-4" />
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`${project.title} live demo`}
                className="relative z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
