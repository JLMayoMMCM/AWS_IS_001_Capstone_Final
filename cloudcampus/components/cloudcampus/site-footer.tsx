import Link from "next/link";
import { Clock, Mail, MapPin } from "lucide-react";

import { getOrg } from "@/lib/queries";

const QUICK_LINKS = [
  { href: "/officers", label: "Officers" },
  { href: "/events", label: "Events" },
  { href: "/blogs", label: "Blog" },
  { href: "/resources", label: "Resources" },
  { href: "/forms", label: "Forms" },
];

export async function SiteFooter() {
  const org = await getOrg();

  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted-foreground md:grid-cols-3 md:px-6 lg:px-8">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{org.name}</h2>
          <p className="max-w-xs leading-normal">{org.tagline}</p>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Quick links</h2>
          <ul className="space-y-1.5">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Contact</h2>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              <span>{org.contact.email}</span>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{org.contact.address}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{org.contact.hours}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground md:px-6 lg:px-8">
          © {new Date().getFullYear()} {org.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
