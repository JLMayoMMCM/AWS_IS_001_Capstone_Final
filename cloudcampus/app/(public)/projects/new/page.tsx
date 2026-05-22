import type { Metadata } from "next";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { BackLink } from "@/components/cloudcampus/back-link";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import type { LookupRow } from "@/lib/lookups";
import { listLookup } from "@/lib/queries";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = {
  title: "Submit a project",
};

export default async function NewProjectPage() {
  const session = await getSession();
  if (session.role === "guest") return <AccessDenied />;

  const categories: LookupRow[] = await listLookup("project-categories");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/projects" label="Projects" />
      <PageHeader
        title="Submit a project"
        subtitle="Your project is reviewed by an admin before it is published. You are added as a contributor automatically."
      />
      <ProjectForm categories={categories} />
    </div>
  );
}
