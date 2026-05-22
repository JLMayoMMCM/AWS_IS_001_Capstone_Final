import type { Metadata } from "next";

import {
  LOOKUP_KEYS,
  listLookup,
  type LookupKey,
  type LookupRow,
} from "@/lib/queries";
import { CategoriesView } from "./categories-view";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const tables = Object.fromEntries(
    await Promise.all(LOOKUP_KEYS.map(async (k) => [k, await listLookup(k)])),
  ) as Record<LookupKey, LookupRow[]>;

  return <CategoriesView tables={tables} />;
}
