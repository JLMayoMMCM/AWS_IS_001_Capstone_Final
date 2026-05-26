import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import logoLight from "@/components/image/HORIZONTAL LOGO.png";
import logoDark from "@/components/image/HORIZONTAL LOGO WHITE.png";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth";
import { defaultOrg } from "@/lib/org";
import { getOrg } from "@/lib/queries";
import { homePathForRole } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to access ${defaultOrg.name} member resources.`,
};

export default async function LoginPage() {
  // A signed-in user has no use for the login page — send them to their home.
  const session = await getSession();
  if (session.role !== "guest") {
    redirect(homePathForRole(session.role));
  }

  const org = await getOrg();

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 md:p-8">
        <div className="flex flex-col items-center text-center">
          <Image
            src={logoLight}
            alt={org.name}
            className="h-8 w-auto dark:hidden"
            priority
          />
          <Image
            src={logoDark}
            alt={org.name}
            className="hidden h-8 w-auto dark:block"
            priority
          />
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.01em]">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to access member resources.
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-foreground hover:underline">
            Apply for membership
          </a>
          . Approval is reviewed by an administrator.
        </p>
      </div>
    </div>
  );
}
