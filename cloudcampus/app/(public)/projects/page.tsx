import type { Metadata } from "next";

import { getSession } from "@/lib/auth";
import { listProjects } from "@/lib/queries";
import { ProjectsView } from "./projects-view";

export const metadata: Metadata = {
  title: "Projects",
  description: "Projects built by CloudCampus members.",
};

export default async function ProjectsPage() {
  const session = await getSession();
  const projects = await listProjects(session.role !== "guest");
  return (
    <ProjectsView
      projects={projects}
      canUpload={session.role !== "guest"}
    />
  );
}
