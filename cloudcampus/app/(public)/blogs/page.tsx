import type { Metadata } from "next";

import { getSession } from "@/lib/auth";
import { listBlogs } from "@/lib/queries";
import { BlogsView } from "./blogs-view";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes, recaps, and guides from CloudCampus members and officers.",
};

export default async function BlogsPage() {
  const session = await getSession();
  const blogs = await listBlogs(session.role !== "guest");
  return <BlogsView blogs={blogs} />;
}
