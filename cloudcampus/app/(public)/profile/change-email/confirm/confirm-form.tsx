"use client";

import { useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ConfirmEmailChange({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; newEmail: string }
    | { ok: false; error: string }
    | null
  >(null);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/profile/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        newEmail?: string;
      };
      if (res.ok && data.newEmail) {
        setResult({ ok: true, newEmail: data.newEmail });
      } else {
        setResult({
          ok: false,
          error: data.error ?? "Could not confirm the change.",
        });
      }
    } catch {
      setResult({
        ok: false,
        error: "Network error. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>
          This link is missing a token. Request a new email change from your
          profile page.
        </AlertDescription>
      </Alert>
    );
  }

  if (result?.ok) {
    return (
      <Alert variant="success">
        <AlertDescription>
          Your sign-in email is now <b>{result.newEmail}</b>. Use it the next
          time you log in.{" "}
          <Link className="underline" href="/login">
            Go to sign-in
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  if (result && !result.ok) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Button onClick={confirm} disabled={busy} className="w-full">
      {busy ? "Confirming…" : "Confirm email change"}
    </Button>
  );
}
