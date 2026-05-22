import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminShell } from "@/components/cloudcampus/admin-shell";
import { getSession } from "@/lib/auth";

/**
 * Admin route group. Guests are redirected to /login by proxy.ts; this layout
 * is the authoritative gate — a logged-in non-admin is shown an access notice
 * (NFR-SEC-08).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (session.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-sm space-y-4">
          <ShieldCheck
            className="mx-auto h-12 w-12 text-muted-foreground"
            aria-hidden
          />
          <h1 className="text-2xl font-semibold">Administrators only</h1>
          <p className="text-sm text-muted-foreground">
            This area is limited to organization administrators.
          </p>
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
