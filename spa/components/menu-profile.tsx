"use client"

import { useAuth } from "@/components/auth-provider"
import {
  AccountAvatar,
  getAccountDisplayName,
} from "@/components/account-avatar"

export function MenuProfile() {
  const { user, status } = useAuth()
  const displayName = getAccountDisplayName(user)

  return (
    <section className="pb-6">
      <AccountAvatar
        user={user}
        className="size-16 border border-border"
        fallbackClassName="bg-secondary text-lg font-medium"
      />
      <div className="mt-4">
        <p className="text-2xl font-semibold">
          {status === "loading" ? "Loading profile" : displayName}
        </p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {user?.username ? `@${user.username}` : "Sign in to show your profile"}
        </p>
      </div>
    </section>
  )
}
