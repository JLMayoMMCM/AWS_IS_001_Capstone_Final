import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Compact officer card for the welcome page's "Current officers" preview
 * (WIRE §5.1): a row on mobile, a centred column on desktop.
 */
export function OfficerPreviewCard({
  name,
  position,
}: {
  name: string;
  position: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 lg:flex-col lg:py-6 lg:text-center">
      <Avatar className="h-12 w-12 lg:h-16 lg:w-16">
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 lg:mt-1">
        <div className="truncate font-medium leading-tight">{name}</div>
        <div className="truncate text-sm text-muted-foreground">{position}</div>
      </div>
    </div>
  );
}
