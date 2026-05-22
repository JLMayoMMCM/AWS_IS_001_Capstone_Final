import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

const SIZES: Record<AvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-sm",
  xl: "size-16 text-base",
  "2xl": "size-20 text-lg",
  "3xl": "size-24 text-xl",
};

/**
 * Avatar for a member. When `memberId` is given it loads the member's profile
 * photo from S3 via /api/members/[id]/photo; if they have no photo (the route
 * 404s) it falls back to their initials.
 */
export function UserAvatar({
  name,
  size = "md",
  className,
  memberId,
}: {
  name: string;
  size?: AvatarSize;
  className?: string;
  /** When set, the member's uploaded photo is shown if they have one. */
  memberId?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {memberId && (
        <AvatarImage src={`/api/members/${memberId}/photo`} alt={name} />
      )}
      <AvatarFallback className="font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
