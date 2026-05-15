"use client"

import { Home, User, Users, Bell, Flame } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useMyFlares } from "@/lib/use-events"

type NavItem =
  | {
      kind: "route"
      icon: typeof Home
      label: string
      href: string
      center?: boolean
    }
  | {
      kind: "action"
      icon: typeof Home
      label: string
      onClick: () => void
      badge?: number
    }

export function BottomNav({
  onOpenNotifications,
  notificationsUnread = 0,
}: {
  // Optional: only the home page handles the popover inline. On other pages,
  // tapping Feed routes back to home where notifications live.
  onOpenNotifications?: () => void
  notificationsUnread?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { hostedByMe } = useMyFlares()
  // An "active" flare = hosted by the user and not cancelled. fetchMyFlares
  // already filters out past events, so a non-empty list here means the user
  // has live/upcoming flares to land on. In that case the center button is a
  // shortcut to the flares hub instead of a fresh create flow.
  const hasActiveFlare = hostedByMe.some((e) => e.apiStatus !== "cancelled")
  const flareHref = hasActiveFlare ? "/event" : "/event/new"

  const items: NavItem[] = [
    { kind: "route", icon: Home, label: "Home", href: "/" },
    {
      kind: "action",
      icon: Bell,
      label: "Feed",
      onClick: onOpenNotifications ?? (() => router.push("/")),
      badge: notificationsUnread,
    },
    {
      kind: "route",
      icon: Flame,
      label: "Light a flare",
      href: flareHref,
      center: true,
    },
    { kind: "route", icon: Users, label: "Circles", href: "/circles" },
    { kind: "route", icon: User, label: "Profile", href: "/profile" },
  ]

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <nav
      aria-label="Primary"
      className="flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {items.map((item) => {
        const Icon = item.icon

        if (item.kind === "route" && item.center) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.href)}
              aria-label={item.label}
              className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
            >
              <Icon className="h-6 w-6" />
            </button>
          )
        }

        const active = item.kind === "route" && isActive(item.href)
        const handleClick =
          item.kind === "route"
            ? () => router.push(item.href)
            : item.onClick

        return (
          <button
            key={item.label}
            type="button"
            onClick={handleClick}
            aria-label={item.label}
            className={`relative flex min-h-11 min-w-11 max-w-20 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
              active
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label.toLowerCase()}</span>
            {item.kind === "action" && (item.badge ?? 0) > 0 && (
              <span
                aria-label={`${item.badge} unread`}
                className="absolute top-0.5 right-1/2 flex h-4 min-w-4 translate-x-3 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground"
              >
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
