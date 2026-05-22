import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { getOrg } from "@/lib/queries";
import { ContentForm } from "./content-form";

export const metadata: Metadata = { title: "Content" };

export default async function AdminContentPage() {
  const org = await getOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        subtitle="The marketing copy shown on public pages."
      />
      <ContentForm org={org} />
    </div>
  );
}
