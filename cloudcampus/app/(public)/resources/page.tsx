import type { Metadata } from "next";

import { getSession } from "@/lib/auth";
import { listResourceCategories, listResources } from "@/lib/queries";
import { ResourcesView } from "./resources-view";

export const metadata: Metadata = {
  title: "Resources",
  description: "Downloadable templates, guides, and reference materials.",
};

export default async function ResourcesPage() {
  const session = await getSession();
  const [resources, categories] = await Promise.all([
    listResources(session.role !== "guest"),
    listResourceCategories(),
  ]);
  return <ResourcesView resources={resources} categories={categories} />;
}
