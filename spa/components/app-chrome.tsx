"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { ActionFeedbackProvider } from "@/components/action-feedback"
import { AuthGate } from "@/components/auth-gate"
import { AuthProvider } from "@/components/auth-provider"
import { AuthenticatedAppShell } from "@/components/authenticated-app-shell"
import { MobileGate } from "@/components/mobile-gate"
import { NewEventDrawerProvider } from "@/components/new-event-drawer-provider"

// What wraps every app page: the mobile gate, the session (which asks the
// auth server who is signed in), the auth gate and the app shell.
//
// #467: the landing page (app/landing) is not the app. It gets none of this:
// no gate, no session check, no nav. It is chosen by the route segment, not
// the url, because on the landing host the proxy rewrites "/" to /landing and
// the browser's path stays "/". The segment comes from the router tree, so the
// server render and the client agree.
export const LANDING_SEGMENT = "landing"

export function AppChrome({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()
  if (segment === LANDING_SEGMENT) return <>{children}</>

  return (
    <MobileGate>
      <AuthProvider>
        <AuthGate>
          <ActionFeedbackProvider>
            <NewEventDrawerProvider>
              <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
            </NewEventDrawerProvider>
          </ActionFeedbackProvider>
        </AuthGate>
      </AuthProvider>
    </MobileGate>
  )
}
