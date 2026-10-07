"use client"

import Link from "next/link"
import { CaretRightIcon } from "@/components/icons"
import { useAuth } from "@/components/auth-provider"
import {
  AccountAvatar,
  getAccountDisplayName,
} from "@/components/account-avatar"

// #369: the profile card at the top of the menu (the home drawer and /menu).
// It is the way in to editing your profile, now that the header's settings
// cog is gone.
export function MenuProfile({
  tabIndex,
  onNavigate,
}: {
  tabIndex?: number
  onNavigate?: () => void
}) {
  const { user, status } = useAuth()
  const displayName = getAccountDisplayName(user)

  return (
    <Link
      href="/settings/profile"
      tabIndex={tabIndex}
      onClick={onNavigate}
      data-menu-profile
      className="-mx-2 flex items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <AccountAvatar
        user={user}
        className="size-14 border border-border"
        fallbackClassName="bg-accent/10 text-base font-medium text-accent-ink"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold">
          {status === "loading" ? "loading profile" : displayName}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {user?.username ? `@${user.username} · edit profile` : "edit profile"}
        </span>
      </span>
      <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
