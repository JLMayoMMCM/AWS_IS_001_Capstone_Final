import type { Metadata } from "next";

import { listMembers } from "@/lib/queries";
import { MembersView } from "./members-view";

export const metadata: Metadata = {
  title: "Members",
  description: "Browse the CloudCampus member directory.",
};

export default async function MembersPage() {
  const members = await listMembers();
  return <MembersView members={members} />;
}
