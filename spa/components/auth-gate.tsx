"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { useSlowRequestHint } from "@/lib/use-slow-request-hint"

const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]
const LEGAL_PATHS = ["/menu/terms", "/menu/privacy"]
const PUBLIC_PATHS = [...AUTH_PATHS, ...LEGAL_PATHS]
const QR_PATH_PREFIX = "/qr/"

function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/"
  if (AUTH_PATHS.some((path) => value === path)) return "/"
  return value
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  // #191/#171: the initial /auth/me check can take a while against a cold
  // backend — swap the bare spinner for the same "waking up…" hint used
  // elsewhere once it's run long enough to plausibly be paying that cost.
  const wakingUp = useSlowRequestHint(status === "loading")

  const isPublic =
    PUBLIC_PATHS.includes(pathname) || pathname.startsWith(QR_PATH_PREFIX)
  const isAuthPage = AUTH_PATHS.includes(pathname)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated" && !isPublic) {
      router.replace("/login")
    } else if (status === "authenticated" && isAuthPage) {
      const redirectPath = getSafeRedirectPath(
        new URLSearchParams(window.location.search).get("redirectTo")
      )
      router.replace(redirectPath)
    }
  }, [status, isPublic, isAuthPage, router])

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
