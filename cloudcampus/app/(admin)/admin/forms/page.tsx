import type { Metadata } from "next";

import { listAllForms } from "@/lib/queries";
import { FormsAdminView } from "./forms-admin-view";

export const metadata: Metadata = { title: "Forms" };

export default async function AdminFormsPage() {
  const forms = await listAllForms();
  return <FormsAdminView forms={forms} />;
}
