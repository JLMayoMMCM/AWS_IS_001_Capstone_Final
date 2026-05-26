import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { listRegistrationRequests } from "@/lib/queries";
import { RegistrationsAdminView } from "./registrations-admin-view";

export const metadata: Metadata = { title: "Registrations" };

export default async function AdminRegistrationsPage() {
  const requests = await listRegistrationRequests();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Registration approvals"
        subtitle="Review applications submitted from the public registration form."
      />
      <RegistrationsAdminView requests={requests} />
    </div>
  );
}
