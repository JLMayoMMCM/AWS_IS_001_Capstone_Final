import type { Metadata } from "next";

import { PageHeader } from "@/components/cloudcampus/page-header";
import { listAnnouncementsAdmin } from "@/lib/queries";
import { AnnouncementsAdminView } from "./announcements-admin-view";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const announcements = await listAnnouncementsAdmin();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Post site-wide updates with a level, audience, and expiry."
      />
      <AnnouncementsAdminView announcements={announcements} />
    </div>
  );
}
