import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/cloudcampus/user-avatar";
import type { OfficerSummary } from "@/lib/types";

/**
 * Officer roster card for the officers page (WIRE §5.3): a large avatar, name,
 * position, term, and an Approver badge for the three event-approver roles.
 */
export function OfficerCard({ officer }: { officer: OfficerSummary }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 text-center text-card-foreground ring-1 ring-foreground/10">
      <UserAvatar
        name={officer.name}
        memberId={officer.memberId}
        size="2xl"
      />
      <div className="space-y-1">
        <h3 className="text-xl font-semibold leading-tight">{officer.name}</h3>
        <p className="text-sm text-muted-foreground">{officer.position}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {officer.term}
        </p>
      </div>
      {officer.isApprover && (
        <Badge variant="outline">
          <ShieldCheck /> Approver
        </Badge>
      )}
    </div>
  );
}
