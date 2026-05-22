import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The 403 "members only" state (WIRE §5.18). Rendered in place of a page body
 * when a guest requests a member-gated route.
 */
export function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
      <div className="max-w-sm space-y-4">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-semibold">Members only</h1>
        <p className="text-sm text-muted-foreground">
          This page is visible to logged-in members. Sign in to continue.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
