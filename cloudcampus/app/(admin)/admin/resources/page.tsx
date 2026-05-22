import type { Metadata } from "next";

import { listResources } from "@/lib/queries";
import { ResourcesAdminView } from "./resources-admin-view";

export const metadata: Metadata = { title: "Resources" };

export default async function AdminResourcesPage() {
  const resources = await listResources(true);
  return <ResourcesAdminView resources={resources} />;
}
