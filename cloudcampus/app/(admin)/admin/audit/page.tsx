import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { listAuditEntries } from "@/lib/queries";
import { AuditView } from "./audit-view";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage() {
  const entries = await listAuditEntries(200);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="An append-only record of every sensitive action. Select a row for details."
      />
      <AuditView entries={entries} />
    </div>
  );
}
