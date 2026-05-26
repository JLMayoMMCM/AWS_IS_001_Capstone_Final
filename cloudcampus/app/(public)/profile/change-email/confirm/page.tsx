import type { Metadata } from "next";

import { ConfirmEmailChange } from "./confirm-form";

export const metadata: Metadata = { title: "Confirm email change" };

/**
 * /profile/change-email/confirm?token=… — the link the user receives at the
 * new address. The page wraps a client form that POSTs the token to
 * /api/profile/email/confirm so the swap can happen with a session cookie if
 * the user is already signed in, or with no session at all.
 */
type Props = { searchParams: Promise<{ token?: string }> };

export default async function ConfirmEmailChangePage({ searchParams }: Props) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4 py-12">
      <h1 className="text-2xl font-semibold">Confirm your new email</h1>
      <p className="text-sm text-muted-foreground">
        Confirm to finish moving your CloudCampus sign-in to this address.
        After confirmation you&apos;ll sign in with the new email.
      </p>
      <ConfirmEmailChange token={token ?? ""} />
    </div>
  );
}
