import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { adminListProjects } from "@/lib/queries";
import { ProjectsAdminView } from "./projects-admin-view";

export const metadata: Metadata = { title: "Projects" };

export default async function AdminProjectsPage() {
  const [pending, approved, rejected, archived] = await Promise.all([
    adminListProjects("pending"),
    adminListProjects("approved"),
    adminListProjects("rejected"),
    adminListProjects("archived"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Review submitted projects and manage their lifecycle."
      />
      <ProjectsAdminView
        pending={pending}
        approved={approved}
        rejected={rejected}
        archived={archived}
      />
    </div>
  );
}
