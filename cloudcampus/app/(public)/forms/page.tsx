import type { Metadata } from "next";

import { getSession } from "@/lib/auth";
import { listForms } from "@/lib/queries";
import { FormsView } from "./forms-view";

export const metadata: Metadata = {
  title: "Forms",
  description: "Recruitment, feedback, and registration forms for CloudCampus.",
};

export default async function FormsPage() {
  const session = await getSession();
  const forms = await listForms(session.role !== "guest");
  return <FormsView forms={forms} />;
}
