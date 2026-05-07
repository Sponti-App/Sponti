"use client"

import { ArrowLeft, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-[390px] h-[844px] bg-background rounded-[40px] border-[8px] border-foreground relative overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 pt-3 pb-2 shrink-0">
          <span className="text-sm font-medium">9:41</span>
          <div className="w-[80px] h-[24px] bg-foreground rounded-full" />
          <div className="flex items-center gap-1">
            <span className="text-xs">•••</span>
            <span className="text-xs">◗</span>
            <span className="text-xs">▌</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button
            onClick={() => router.push("/")}
            aria-label="Back"
            className="h-9 w-9 rounded-full border border-foreground flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold">profile</span>
          <div className="h-9 w-9" aria-hidden />
        </div>

        <div className="flex-1 flex flex-col items-center px-6 pt-6 pb-32 overflow-y-auto">
          <div className="h-20 w-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
            <span className="text-2xl font-semibold text-accent">
              {user?.displayName?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <h1 className="text-xl font-bold">{user?.displayName ?? ""}</h1>
          <p className="text-sm text-muted-foreground mb-1">@{user?.username ?? ""}</p>
          <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>

          <div className="w-full mt-10">
            <Button
              variant="outline"
              onClick={() => logout()}
              className="w-full rounded-full py-6 text-base"
            >
              <LogOut className="h-4 w-4 mr-2" />
              sign out
            </Button>
          </div>
        </div>

        <div className="absolute bottom-6 left-0 right-0 z-10">
          <BottomNav />
        </div>

        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <div className="w-32 h-1 bg-foreground rounded-full" />
        </div>
      </div>
    </div>
  )
}
