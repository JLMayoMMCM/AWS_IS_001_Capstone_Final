import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, ExternalLink, GitBranch, Lock, Pencil, Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { ApprovalPanel } from "@/components/cloudcampus/approval-panel";
import { BackLink } from "@/components/cloudcampus/back-link";
import { PlaceholderImage } from "@/components/cloudcampus/placeholder-image";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { getSession } from "@/lib/auth";
import { getProject } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return {
    title: project ? project.title : "Project",
    description: project?.summary,
  };
}

export default async function ProjectDetailPage({ params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const session = await getSession();
  const publicView =
    project.status === "approved" && project.visibility === "public";
  if (session.role === "guest" && !publicView) return <AccessDenied />;

  const isOwner =
    !!session.memberId && session.memberId === project.submittedBy;
  const isOfficer = session.role === "officer" || session.role === "admin";
  if (project.status !== "approved" && !isOwner && !isOfficer) {
    return <AccessDenied />;
  }

  const contributors = project.contributors;

  return (
    <div className="space-y-6">
      <BackLink href="/projects" label="Projects" />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-8">
          {project.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={project.coverUrl}
              alt={project.coverAlt}
              loading="lazy"
              className="aspect-video w-full rounded-xl object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <PlaceholderImage
              alt={project.coverAlt}
              aspect="aspect-video"
              className="rounded-xl ring-1 ring-foreground/10"
            />
          )}

          <div className="space-y-2">
            <h1 className="text-3xl font-bold leading-tight tracking-[-0.02em] md:text-4xl">
              {project.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {project.category && (
                <Badge variant="secondary">{project.category}</Badge>
              )}
              {project.status === "approved" && (
                <Badge variant="success">
                  <Check /> Approved
                </Badge>
              )}
              {project.visibility === "private" && (
                <Badge variant="outline">
                  <Lock /> Private
                </Badge>
              )}
            </div>
            <p className="max-w-prose pt-1 text-muted-foreground">
              {project.summary}
            </p>
            {(isOwner || session.role === "admin") &&
              project.status !== "rejected" && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/projects/${project.id}/edit`}>
                    <Pencil />
                    Edit project
                  </Link>
                </Button>
              )}
          </div>

          {isOfficer && project.status === "pending" && (
            <ApprovalPanel
              entity="project"
              id={project.id}
              status={project.status}
            />
          )}

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">About this project</h2>
            <div className="max-w-prose space-y-3 leading-relaxed text-foreground/90">
              {project.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>

          {project.attachments.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Attachments</h2>
              {project.attachments.some(
                (a) => a.kind === "image" && a.imageUrl,
              ) && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {project.attachments
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
              {project.attachments.some(
                (a) => a.kind === "link" && a.url,
              ) && (
                <ul className="space-y-2">
                  {project.attachments
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

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Contributors</h2>
            <div className="space-y-2">
              {contributors.map((member) => (
                <Link
                  key={member.id}
                  href={`/members/${member.id}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <UserAvatar name={member.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {member.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {member.course}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Screenshots</h2>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((n) => (
                <PlaceholderImage
                  key={n}
                  alt={`${project.title} screenshot ${n}`}
                  aspect="aspect-[4/3]"
                  className="rounded-md ring-1 ring-foreground/10"
                />
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4">
          <div className="space-y-5 rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10 lg:sticky lg:top-20">
            <div className="space-y-2">
              {project.repoUrl && (
                <Button asChild className="w-full">
                  <a href={project.repoUrl} target="_blank" rel="noreferrer">
                    <GitBranch /> View repository
                  </a>
                </Button>
              )}
              {project.liveUrl && (
                <Button
                  asChild
                  variant={project.repoUrl ? "outline" : "default"}
                  className="w-full"
                >
                  <a href={project.liveUrl} target="_blank" rel="noreferrer">
                    <ExternalLink /> Live demo
                  </a>
                </Button>
              )}
              {project.publishedUrl && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={project.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Rocket /> Published
                  </a>
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Built with
              </div>
              <div className="flex flex-wrap gap-1.5">
                {project.stack.map((tech) => (
                  <Badge key={tech} variant="secondary">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Started</dt>
                <dd>{project.startedOn}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Completed</dt>
                <dd>{project.completedOn}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Contributors</dt>
                <dd>{contributors.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
