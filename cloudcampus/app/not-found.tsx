import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 404 page (WIRE §5.18). Rendered for unmatched URLs and for `notFound()`
 * calls from detail pages. Self-contained so it works outside the public shell.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div className="max-w-sm space-y-4">
        <Compass
          className="mx-auto h-12 w-12 text-muted-foreground"
          aria-hidden
        />
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          We could not find the page you were looking for.
        </p>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
