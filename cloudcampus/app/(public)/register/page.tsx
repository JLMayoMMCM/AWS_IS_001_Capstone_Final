import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getOrg, listLookup } from "@/lib/queries";
import { homePathForRole } from "@/lib/routes";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register",
  description: "Apply for membership.",
};

export default async function RegisterPage() {
  const session = await getSession();
  if (session.role !== "guest") {
    redirect(homePathForRole(session.role));
  }
  const [org, courses] = await Promise.all([getOrg(), listLookup("courses")]);

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <div className="w-full max-w-md rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 md:p-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">
            Apply for membership
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit your details to join {org.name}. An administrator will
            review and approve your application.
          </p>
        </div>
        <RegisterForm courses={courses} />
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="text-foreground hover:underline">
            Sign in
          </a>
          .
        </p>
      </div>
    </div>
  );
}
