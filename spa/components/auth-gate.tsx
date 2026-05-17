"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]
const ONBOARDING_PATH = "/onboarding"
const LEGAL_PATHS = ["/menu/terms", "/menu/privacy"]
const PUBLIC_PATHS = [...AUTH_PATHS, ONBOARDING_PATH, ...LEGAL_PATHS]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isPublic = PUBLIC_PATHS.includes(pathname)
  const isAuthPage = AUTH_PATHS.includes(pathname)
  const isOnboardingPage = pathname === ONBOARDING_PATH

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated" && !isPublic) {
      router.replace("/login")
    } else if (status === "authenticated" && (isAuthPage || isOnboardingPage)) {
      router.replace("/")
    }
  }, [status, isPublic, isAuthPage, isOnboardingPage, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (status === "unauthenticated" && !isPublic) return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  )
  if (status === "authenticated" && (isAuthPage || isOnboardingPage)) return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  )

  return <>{children}</>
}
