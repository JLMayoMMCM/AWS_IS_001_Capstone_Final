import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { getMember } from "@/lib/queries";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Your profile",
};

export default async function ProfilePage() {
  const session = await getSession();
  if (session.role === "guest" || !session.memberId) {
    return <AccessDenied />;
  }

  const member = await getMember(session.memberId);
  if (!member) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Your profile" />
      <ProfileForm member={member} />
    </div>
  );
}
