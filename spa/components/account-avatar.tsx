"use client"

import type { AuthUser } from "@/lib/auth-store"
import { initialsFromName } from "@/lib/profile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type AccountAvatarProps = {
  user: AuthUser | null
  className?: string
  fallbackClassName?: string
}

export function getAccountDisplayName(user: AuthUser | null): string {
  return user?.displayName?.trim() || user?.username?.trim() || "Signed out"
}

export function getAccountInitials(user: AuthUser | null): string {
  const name = user?.displayName?.trim() || user?.username?.trim()
  return name ? initialsFromName(name) : "?"
}

export function AccountAvatar({
  user,
  className,
  fallbackClassName,
}: AccountAvatarProps) {
  const displayName = getAccountDisplayName(user)
  const avatarUrl = user?.avatarUrl?.trim()

  return (
    <Avatar className={className}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={`${displayName} profile photo`} />
      ) : null}
      <AvatarFallback className={fallbackClassName}>
        {getAccountInitials(user)}
      </AvatarFallback>
    </Avatar>
  )
}
