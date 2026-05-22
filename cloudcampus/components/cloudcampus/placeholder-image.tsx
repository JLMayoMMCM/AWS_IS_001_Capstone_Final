import { cn } from "@/lib/utils";

/**
 * Diagonal-stripe placeholder that stands in for an image asset that does not
 * exist yet (hero photo, event cover, blog cover). It carries the eventual
 * alt text as a visible caption chip and as an accessible label.
 *
 * Replaced with `next/image` once real assets land (Phase 3+).
 */
export function PlaceholderImage({
  alt,
  aspect = "aspect-video",
  className,
}: {
  /** The alt text the real image will use; also shown as a caption chip. */
  alt: string;
  /** Tailwind aspect-ratio class. Defaults to 16:9. */
  aspect?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "ph-stripes relative w-full overflow-hidden",
        aspect,
        className,
      )}
    >
      <div className="absolute inset-0 flex items-end p-3">
        <span className="rounded-sm border border-border bg-background/80 px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {alt}
        </span>
      </div>
    </div>
  );
}
