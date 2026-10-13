"use client"

import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import {
  AccountAvatar,
  getAccountDisplayName,
} from "@/components/account-avatar"

// #369, #559: the profile card at the top of the menu (the home drawer and
// /menu). The avatar and name open your profile as others see it; "edit"
// beside it is the way in to editing, now that the header's settings cog is
// gone. Until the username loads, the card is the edit link alone.
export function MenuProfile({
  tabIndex,
  onNavigate,
}: {
  tabIndex?: number
  onNavigate?: () => void
}) {
  const { user, status } = useAuth()
  const displayName = getAccountDisplayName(user)
  const profileHref = user?.username
    ? `/profile/${encodeURIComponent(user.username)}`
    : "/settings/profile"

  return (
    <div
      data-menu-profile
      className="-mx-2 flex items-center gap-2 rounded-2xl p-2"
    >
      <Link
        href={profileHref}
        tabIndex={tabIndex}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors hover:bg-muted active:bg-muted"
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
            {user?.username
              ? `@${user.username} · view profile`
              : "view profile"}
          </span>
        </span>
      </Link>
      <Link
        href="/settings/profile"
        tabIndex={tabIndex}
        onClick={onNavigate}
        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
      >
        edit profile
      </Link>
    </div>
  )
}
