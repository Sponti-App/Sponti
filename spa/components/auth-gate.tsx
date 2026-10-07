"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { isContactPath } from "@/lib/contact-links"
import { LEGAL_PATHS } from "@/lib/legal-paths"
import { useOnboardingFlags } from "@/lib/onboarding-flags"
import {
  AUTH_PATHS,
  buildLoginPath,
  getRedirectTarget,
} from "@/lib/redirect-path"
import { useSlowRequestHint } from "@/lib/use-slow-request-hint"

const PUBLIC_PATHS = [...AUTH_PATHS, ...LEGAL_PATHS]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  // #191/#171: the initial /auth/me check can take a while against a cold
  // backend — swap the bare spinner for the same "waking up…" hint used
  // elsewhere once it's run long enough to plausibly be paying that cost.
  const wakingUp = useSlowRequestHint(status === "loading")
  // #482: "new onboarding" can be switched on per device, which the server
  // and the hydration render can't see. Until `decided`, the gate stays on its
  // spinner and doesn't redirect, so "/" never flashes the login page.
  const { browseBeforeSignup, decided } = useOnboardingFlags()

  // #124: QR and invite links open for signed-out visitors, who are sent
  // on to sign-up from there. #389: with `browseBeforeSignup`, so does the
  // home map, which then renders its signed-out view.
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    isContactPath(pathname) ||
    (browseBeforeSignup && pathname === "/")
  const isAuthPage = AUTH_PATHS.includes(pathname)
  // Signing out in this tab is the one move from "authenticated" straight to
  // "unauthenticated" (a rejected session passes through "loading" first).
  const wasAuthenticated = useRef(false)

  useEffect(() => {
    if (status === "loading" || !decided) return
    const signedOutHere = wasAuthenticated.current
    wasAuthenticated.current = status === "authenticated"
    if (status === "unauthenticated" && !isPublic) {
      // #482: with `browseBeforeSignup`, signing out lands on the signed-out
      // home map (and the intro slides there), not the login page.
      if (signedOutHere && browseBeforeSignup) {
        router.replace("/")
        return
      }
      // #219: remember where the user was heading so signing in returns
      // them there instead of dropping them on the home map.
      router.replace(buildLoginPath(`${pathname}${window.location.search}`))
    } else if (status === "authenticated" && isAuthPage) {
      router.replace(getRedirectTarget())
    }
  }, [
    status,
    decided,
    pathname,
    isPublic,
    isAuthPage,
    browseBeforeSignup,
    router,
  ])

  if (status === "loading" || !decided) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        {wakingUp && (
          <p className="text-xs text-muted-foreground">waking up the server…</p>
        )}
      </div>
    )
  }

  if (status === "unauthenticated" && !isPublic)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  if (status === "authenticated" && isAuthPage)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )

  return <>{children}</>
}
