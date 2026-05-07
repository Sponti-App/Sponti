"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

const PUBLIC_PATHS = ["/login", "/register"]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated" && !isPublic) {
      router.replace("/login")
    } else if (status === "authenticated" && isPublic) {
      router.replace("/")
    }
  }, [status, isPublic, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (status === "unauthenticated" && !isPublic) return null
  if (status === "authenticated" && isPublic) return null

  return <>{children}</>
}
