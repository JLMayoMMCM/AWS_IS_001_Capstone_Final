"use client";

import { createContext, useContext } from "react";

import { GUEST_SESSION, type Session } from "@/lib/session";

const SessionContext = createContext<Session>(GUEST_SESSION);

/**
 * Makes the server-resolved session available to client components (interactive
 * list pages, the header). The value is provided once by the root layout.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

/** Reads the current session inside a client component. */
export function useSession(): Session {
  return useContext(SessionContext);
}
