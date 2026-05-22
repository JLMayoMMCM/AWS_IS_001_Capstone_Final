import type { Role } from "@/lib/types";

/**
 * The resolved session for a request. Client-safe: this module holds only the
 * shape and the guest constant so it can be imported by client components
 * (e.g. the SessionProvider). The server-side resolver lives in lib/auth.ts.
 */
export interface Session {
  /** Effective role: 'guest', 'member', 'officer' (derived), or 'admin'. */
  role: Role;
  /** users.id, or null for guests. */
  userId: string | null;
  /** members.id, or null for guests. */
  memberId: string | null;
}

export const GUEST_SESSION: Session = {
  role: "guest",
  userId: null,
  memberId: null,
};
