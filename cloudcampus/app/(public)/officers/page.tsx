import type { Metadata } from "next";

import { getOrg, listOfficers } from "@/lib/queries";
import { OfficersView } from "./officers-view";

export const metadata: Metadata = {
  title: "Officers",
  description: "Meet the current CloudCampus officer team.",
};

export default async function OfficersPage() {
  const [officers, org] = await Promise.all([listOfficers(), getOrg()]);
  return <OfficersView officers={officers} currentTerm={org.term} />;
}
