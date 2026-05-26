import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/cloudcampus/access-denied";
import { PageHeader } from "@/components/cloudcampus/page-header";
import { getSession } from "@/lib/auth";
import { getMember, listLookup } from "@/lib/queries";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Your profile",
};

export default async function ProfilePage() {
  const session = await getSession();
  if (session.role === "guest" || !session.memberId || !session.userId) {
    return <AccessDenied />;
  }

  const [member, courses] = await Promise.all([
    getMember(session.memberId),
    listLookup("courses"),
  ]);
  if (!member) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Your profile" />
      <ProfileForm member={member} courses={courses} />
    </div>
  );
}
