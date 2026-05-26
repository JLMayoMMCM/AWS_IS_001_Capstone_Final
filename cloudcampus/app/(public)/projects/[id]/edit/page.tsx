import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import type { LookupRow } from "@/lib/lookups";
import { getProject, listLookup } from "@/lib/queries";
import { ProjectForm } from "../../new/project-form";

export const metadata: Metadata = { title: "Edit project" };

type Props = { params: Promise<{ id: string }> };

/**
 * /projects/[id]/edit — the submitter (or an admin) re-opens the project.
 * Saving returns it to the review queue (V2.1 §1.2). Rejected projects are
 * not editable.
 */
export default async function EditProjectPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (session.role === "guest" || !session.memberId) return <AccessDenied />;
  const project = await getProject(id);
  if (!project) notFound();

  const isOwner = project.submittedBy === session.memberId;
  if (!isOwner && session.role !== "admin") return <AccessDenied />;
  if (project.status === "rejected") redirect(`/projects/${id}`);

  const categories: LookupRow[] = await listLookup("project-categories");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Edit: ${project.title}`}
        subtitle="Saving returns this project to the review queue."
      />
      <ProjectForm categories={categories} existing={project} />
    </div>
  );
}
