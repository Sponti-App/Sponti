"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type StackPerson = {
  id?: string
  displayName?: string
  username?: string
  name?: string
  avatarUrl?: string | null
}

export function EventAvatarStack({
  people,
  count,
  cap,
  size = "sm",
  className,
}: {
  people: StackPerson[]
  count?: number
  cap?: number
  size?: "xs" | "sm"
  className?: string
}) {
  const visible = people.slice(0, 3)
  const avatarSize = size === "xs" ? "size-5" : "size-6"
  const textSize = "text-xs"
  const total = count ?? people.length

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      {visible.length > 0 && (
        <div className="flex -space-x-1.5">
          {visible.map((person, index) => {
            const label =
              person.displayName ?? person.name ?? person.username ?? "?"
            return (
              <Avatar
                key={person.id ?? `${label}-${index}`}
                className={cn(avatarSize, "ring-2 ring-background")}
              >
                {person.avatarUrl && (
                  <AvatarImage src={person.avatarUrl} alt="" />
                )}
                <AvatarFallback className={textSize}>
                  {initials(label)}
                </AvatarFallback>
              </Avatar>
            )
          })}
        </div>
      )}
      <span
        className={cn(
          "font-medium text-muted-foreground tabular-nums",
          textSize
        )}
      >
        {total}
        {cap ? `/${cap}` : ""}
      </span>
    </div>
  )
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}
