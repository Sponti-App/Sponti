"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { isContactPath } from "@/lib/contact-links"
import {
  AUTH_PATHS,
  buildLoginPath,
  getRedirectTarget,
} from "@/lib/redirect-path"
import { useSlowRequestHint } from "@/lib/use-slow-request-hint"

const LEGAL_PATHS = ["/menu/terms", "/menu/privacy", "/menu/impressum"]
const PUBLIC_PATHS = [...AUTH_PATHS, ...LEGAL_PATHS]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  // #191/#171: the initial /auth/me check can take a while against a cold
  // backend — swap the bare spinner for the same "waking up…" hint used
  // elsewhere once it's run long enough to plausibly be paying that cost.
  const wakingUp = useSlowRequestHint(status === "loading")

  // #124: QR and invite links open for signed-out visitors, who are sent
  // on to sign-up from there.
  const isPublic = PUBLIC_PATHS.includes(pathname) || isContactPath(pathname)
  const isAuthPage = AUTH_PATHS.includes(pathname)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated" && !isPublic) {
      // #219: remember where the user was heading so signing in returns
      // them there instead of dropping them on the home map.
      router.replace(buildLoginPath(`${pathname}${window.location.search}`))
    } else if (status === "authenticated" && isAuthPage) {
      router.replace(getRedirectTarget())
    }
  }, [status, pathname, isPublic, isAuthPage, router])

  if (status === "loading") {
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
