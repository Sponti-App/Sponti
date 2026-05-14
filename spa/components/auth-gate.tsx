"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"]
const PUBLIC_PATHS = [...AUTH_PATHS, "/onboarding"]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isPublic = PUBLIC_PATHS.includes(pathname)
  const isAuthPage = AUTH_PATHS.includes(pathname)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated" && !isPublic) {
      router.replace("/onboarding")
    } else if (status === "authenticated" && isAuthPage) {
      router.replace("/")
    }
  }, [status, isPublic, isAuthPage, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (status === "unauthenticated" && !isPublic) return null
  if (status === "authenticated" && isAuthPage) return null

  return <>{children}</>
}
