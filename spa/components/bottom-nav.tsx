"use client"

import { useEffect, useRef } from "react"
import { Home, Inbox, Users, Bell, Flame } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useMyFlares } from "@/lib/use-events"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { haptic } from "@/lib/haptics"

type NavItem =
  | {
      kind: "route"
      icon: typeof Home
      label: string
      href: string
      center?: boolean
      badge?: number
    }
  | {
      kind: "action"
      icon: typeof Home
      label: string
      onClick: () => void
      center?: boolean
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
  const { openDrawer } = useNewEventDrawer()
  const { hostedByMe, invited } = useMyFlares()
  const activeHosted = hostedByMe.filter((e) => e.apiStatus !== "cancelled")
  // Badge counts hosted-by-me + invited so users see a heads-up when there's
  // something waiting in the hub (a new invitation, a flare they're hosting).
  const flaresBadge = activeHosted.length + invited.length

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
      kind: "action",
      icon: Flame,
      label: "Light a flare",
      onClick: openDrawer,
      center: true,
    },
    { kind: "route", icon: Users, label: "Circles", href: "/circles" },
    {
      kind: "route",
      icon: Inbox,
      label: "My flares",
      href: "/event",
      badge: flaresBadge,
    },
  ]

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  // Publish the actual rendered nav height (incl. safe-area inset) as a CSS
  // variable so the floating bottom sheet and FAB can sit flush above the bar
  // on every device. Avoids the visible gap caused by hard-coded heights.
  const navRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const write = () =>
      document.documentElement.style.setProperty(
        "--sponti-nav-h",
        `${el.offsetHeight}px`,
      )
    write()
    const ro = new ResizeObserver(write)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className="flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {items.map((item) => {
        const Icon = item.icon

        if (item.center) {
          const centerClick =
            item.kind === "route"
              ? () => { haptic("medium"); router.push(item.href) }
              : () => { haptic("medium"); item.onClick() }
          return (
            <button
              key={item.label}
              type="button"
              onClick={centerClick}
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
            ? () => { haptic("selection"); router.push(item.href) }
            : () => { haptic("selection"); item.onClick() }

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
            {(item.badge ?? 0) > 0 && (
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
