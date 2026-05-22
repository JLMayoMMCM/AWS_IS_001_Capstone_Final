import type { LucideIcon } from "lucide-react";

/** Centred empty state: icon, heading, supporting text, optional CTA (WIRE §4). */
export function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground" aria-hidden />
      <h3 className="mt-3 text-xl font-semibold">{title}</h3>
      {body && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      )}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}
