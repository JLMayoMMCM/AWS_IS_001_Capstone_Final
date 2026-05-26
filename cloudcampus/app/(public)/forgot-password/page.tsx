import type { Metadata } from "next";

import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your CloudCampus password.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 md:p-8">
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a link to reset your password.
        </p>
        <ForgotForm />
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Remembered it?{" "}
          <a href="/login" className="text-foreground hover:underline">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
