import type { Metadata } from "next";

import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Set a new password",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 md:p-8">
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">
          Set a new password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a new password to sign in with.
        </p>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <p className="mt-6 text-sm text-destructive">
            This reset link is missing its token. Request a new one from the
            <a href="/forgot-password" className="ml-1 underline">
              forgot password page
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
