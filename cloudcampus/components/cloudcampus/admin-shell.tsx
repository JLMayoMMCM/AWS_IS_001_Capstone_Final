"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Files,
  KeyRound,
  LayoutDashboard,
  Menu,
  Newspaper,
  Pencil,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/cloudcampus/theme-toggle";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/content", label: "Content", icon: Pencil },
  { href: "/admin/officers", label: "Officers", icon: ShieldCheck },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/blogs/approval", label: "Blogs", icon: Newspaper },
  { href: "/admin/projects", label: "Projects", icon: Briefcase },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/resources", label: "Resources", icon: Files },
  { href: "/admin/forms", label: "Forms", icon: ClipboardList },
  { href: "/admin/roles", label: "Roles", icon: KeyRound },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/audit", label: "Audit", icon: Activity },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            isActive(pathname, href)
              ? "bg-accent font-medium text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-muted/40 lg:flex">
        <Link
          href="/"
          className="flex h-14 items-center gap-2 border-b border-border px-4"
        >
          <span className="text-sm font-semibold">CloudCampus</span>
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
            Admin
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto p-2">
          <NavLinks />
        </div>
        <div className="border-t border-border p-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open admin menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle>Admin</SheetTitle>
                </SheetHeader>
                <div className="px-2">
                  <SheetClose asChild>
                    <span>
                      <NavLinks onNavigate={() => setMenuOpen(false)} />
                    </span>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-sm font-semibold lg:hidden">
              CloudCampus Admin
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 md:py-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
