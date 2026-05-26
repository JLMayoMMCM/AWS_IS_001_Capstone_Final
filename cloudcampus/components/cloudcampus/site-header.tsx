"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, User } from "lucide-react";

import logoLight from "@/components/image/HORIZONTAL LOGO.png";
import logoDark from "@/components/image/HORIZONTAL LOGO WHITE.png";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/cloudcampus/theme-toggle";
import { useSession } from "@/components/cloudcampus/session-provider";

const NAV_LINKS = [
  { href: "/officers", label: "Officers" },
  { href: "/members", label: "Members" },
  { href: "/projects", label: "Projects" },
  { href: "/events", label: "Events" },
  { href: "/blogs", label: "Blogs" },
  { href: "/resources", label: "Resources" },
  { href: "/forms", label: "Forms" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center" aria-label="CloudCampus home">
      <Image
        src={logoLight}
        alt="CloudCampus"
        className="h-7 w-auto dark:hidden"
        priority
      />
      <Image
        src={logoDark}
        alt="CloudCampus"
        className="hidden h-7 w-auto dark:block"
        priority
      />
    </Link>
  );
}

export function SiteHeader() {
  const session = useSession();
  const router = useRouter();
  const isAuthed = session.role !== "guest";
  const isAdmin = session.role === "admin";
  // Officers reach the event-approval queue from the nav; the page itself
  // still gates voting to approver-position holders.
  const isOfficer = session.role === "officer" || session.role === "admin";

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Full reload guarantees server-rendered pages drop the previous role's
    // cached payload — router.refresh() alone keeps stale state on some routes.
    window.location.assign("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6 lg:px-8">
        <Logo />

        <nav
          aria-label="Primary"
          className="hidden lg:flex lg:items-center lg:gap-1"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {link.label}
            </Link>
          ))}
          {isOfficer && (
            <Link
              href="/events/approvals"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Approvals
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />

          {isAuthed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Account menu"
                >
                  <Avatar className="size-8">
                    <AvatarFallback>
                      <User className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User /> Your profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <LayoutDashboard /> Admin dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={signOut}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/login">Login</Link>
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                {isOfficer && (
                  <SheetClose asChild>
                    <Link
                      href="/events/approvals"
                      className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Approvals
                    </Link>
                  </SheetClose>
                )}
                <Separator className="my-2" />
                {isAuthed ? (
                  <>
                    <SheetClose asChild>
                      <Link
                        href="/profile"
                        className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        Your profile
                      </Link>
                    </SheetClose>
                    {isAdmin && (
                      <SheetClose asChild>
                        <Link
                          href="/admin"
                          className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          Admin dashboard
                        </Link>
                      </SheetClose>
                    )}
                    <SheetClose asChild>
                      <button
                        type="button"
                        onClick={signOut}
                        className="rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        Sign out
                      </button>
                    </SheetClose>
                  </>
                ) : (
                  <SheetClose asChild>
                    <Link
                      href="/login"
                      className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Login
                    </Link>
                  </SheetClose>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
