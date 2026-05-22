import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, ExternalLink, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { BackLink } from "@/components/cloudcampus/back-link";
import { ResourceIcon } from "@/components/cloudcampus/resource-icon";
import { ResourcePreview } from "@/components/cloudcampus/resource-preview";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import { getSession } from "@/lib/auth";
import { getMember, getResource } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const { id } = await params;
  const resource = await getResource(id);
  return {
    title: resource ? resource.title : "Resource",
    description: resource?.description,
  };
}

export default async function ResourceDetailPage({ params }: Params) {
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource) notFound();

  const session = await getSession();
  if (resource.visibility === "private" && session.role === "guest") {
    return <AccessDenied />;
  }

  const uploader = await getMember(resource.uploadedBy);

  return (
    <div className="space-y-6">
      <BackLink href="/resources" label="Resources" />

      <div className="flex items-start gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
          aria-hidden
        >
          <ResourceIcon type={resource.type} className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl font-bold leading-tight tracking-[-0.02em] md:text-4xl">
              {resource.title}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{resource.category}</Badge>
              {resource.visibility === "private" && (
                <Badge variant="outline">
                  <Lock /> Members only
                </Badge>
              )}
            </div>
          </div>
          <p className="mt-2 max-w-prose text-muted-foreground">
            {resource.description}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Preview */}
        <div className="lg:col-span-8">
          <ResourcePreview
            resourceId={resource.id}
            type={resource.type}
            title={resource.title}
          />
        </div>

        {/* Actions + metadata */}
        <div className="lg:col-span-4">
          <div className="space-y-4 rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10 lg:sticky lg:top-20">
            <Button asChild className="w-full">
              <a href={`/api/resources/${resource.id}/download?download=1`}>
                <Download /> Download · {resource.size}
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a
                href={`/api/resources/${resource.id}/download`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink /> Open in new tab
              </a>
            </Button>
            <Separator />
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Uploaded by</dt>
                <dd className="flex items-center gap-2">
                  <UserAvatar name={uploader?.name ?? "Unknown"} size="xs" />
                  {uploader?.name ?? "Unknown"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{resource.dateLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Size</dt>
                <dd>{resource.size}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-mono uppercase">{resource.type}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
