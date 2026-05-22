import { UserAvatar } from "@/components/cloudcampus/user-avatar";

/** Overlapping avatars with a "+N" overflow chip (WIRE §5.11). */
export function AvatarStack({
  names,
  max = 4,
}: {
  names: string[];
  max?: number;
}) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((name, i) => (
        <div key={i} className="rounded-full ring-2 ring-background">
          <UserAvatar name={name} size="xs" />
        </div>
      ))}
      {overflow > 0 && (
        <div className="rounded-full ring-2 ring-background">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
}
