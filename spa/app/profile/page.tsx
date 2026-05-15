"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, LogOut } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/components/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AuthUser } from "@/lib/auth-store"

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  return <ProfileOverview user={user} />
}

function ProfileOverview({ user }: { user: Pick<AuthUser, "displayName" | "username" | "email" | "avatarUrl"> }) {
  const router = useRouter()
  const { logout } = useAuth()

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border">
        <button
          onClick={() => router.push("/")}
          aria-label="Back"
          className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold">profile</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/profile/edit")}
          className="rounded-full border border-foreground px-3"
        >
          edit
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <Card className="border-border bg-card/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[15px]">your profile</CardTitle>
            <CardDescription>
              This is what other people see before you decide to share more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 ring-1 ring-border bg-muted">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
                <AvatarFallback className="bg-muted">
                  {user.displayName?.charAt(0).toUpperCase() ?? user.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">profile picture</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {user.avatarUrl ? "Your current profile photo." : "Empty for now."}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">name</p>
                <p className="text-sm font-medium">{user.displayName}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">username</p>
                <p className="text-sm font-medium">@{user.username}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">email</p>
                <p className="text-sm font-medium">{user.email}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
              Use edit to update your public details.
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => logout()}
            className="rounded-full border-destructive/20 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            sign out
          </Button>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 z-10">
        <BottomNav />
      </div>
    </div>
  )
}
