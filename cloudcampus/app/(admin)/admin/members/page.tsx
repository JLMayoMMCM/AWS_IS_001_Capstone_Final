import type { Metadata } from "next";

import { getSession } from "@/lib/auth";
import { listMembers } from "@/lib/queries";
import { MembersAdminView } from "./members-admin-view";

export const metadata: Metadata = { title: "Members" };

export default async function AdminMembersPage() {
  const [members, session] = await Promise.all([listMembers(), getSession()]);

  return (
    <MembersAdminView members={members} currentMemberId={session.memberId} />
  );
}
