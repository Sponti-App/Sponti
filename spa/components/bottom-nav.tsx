"use client"

import { useEffect, useRef } from "react"
import {
  HouseIcon,
  FireIcon,
  UsersIcon,
  BellIcon,
  FlameIcon,
  type Icon,
} from "@/components/icons"
import { usePathname, useRouter } from "next/navigation"
import { useMyFlares } from "@/lib/use-events"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { haptic } from "@/lib/haptics"
import { useSuggestedFlareType } from "@/lib/suggested-flare-type"
import { EVENT_TYPES } from "@/types/utils"

type NavItem =
  | {
      kind: "route"
      icon: Icon
      label: string
      href: string
      center?: boolean
      badge?: number
    }
  | {
      kind: "action"
      icon: Icon
      label: string
      onClick: () => void
      center?: boolean
      badge?: number
    }

export function BottomNav({
  onOpenNotifications,
  notificationsUnread = 0,
}: {
  // AuthenticatedAppShell owns the notifications sheet. The fallback keeps isolated
  // story/test renders useful if no shell handler is supplied.
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
  // On the home map, the flare button takes the icon of the type the map is
  // suggesting (one type chip on, nothing live of that type, #223). The map
  // resets it when it unmounts; the pathname check is a second guard so no
  // other screen ever shows a type icon.
  const suggestedType = useSuggestedFlareType()
  const flareIcon =
    (pathname === "/" &&
      EVENT_TYPES.find((t) => t.value === suggestedType)?.icon) ||
    FlameIcon

  const items: NavItem[] = [
    { kind: "route", icon: HouseIcon, label: "Home", href: "/" },
    {
      kind: "action",
      icon: BellIcon,
      label: "Feed",
      onClick: onOpenNotifications ?? (() => router.push("/")),
      badge: notificationsUnread,
    },
    {
      kind: "action",
      icon: flareIcon,
      label: "flare",
      onClick: () => openDrawer(),
      center: true,
    },
    { kind: "route", icon: UsersIcon, label: "Circles", href: "/circles" },
    {
      kind: "route",
      icon: FireIcon,
      label: "my flares",
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
        `${el.offsetHeight}px`
      )
    write()
    const ro = new ResizeObserver(write)
    // Border box, not the default content box: when Safari collapses its
    // toolbars only env(safe-area-inset-bottom) changes, i.e. the nav's
    // padding, so a content-box observer never fires and the variable goes
    // stale by the inset (#223).
    ro.observe(el, { box: "border-box" })
    return () => ro.disconnect()
  }, [])

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className="flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {items.map((item) => {
        if (item.center && item.kind === "action") {
          return (
            <NavFlareButton
              key={item.label}
              icon={item.icon}
              label={item.label}
              onClick={() => {
                haptic("medium")
                item.onClick()
              }}
            />
          )
        }
        const Icon = item.icon
        const active = item.kind === "route" && isActive(item.href)
        const handleClick =
          item.kind === "route"
            ? () => {
                haptic("selection")
                router.push(item.href)
              }
            : () => {
                haptic("selection")
                item.onClick()
              }

        return (
          <button
            key={item.label}
            type="button"
            onClick={handleClick}
            aria-label={item.label}
            className={`relative flex min-h-11 max-w-20 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium active:scale-95 active:opacity-80 ${
              active
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {/* The active tab's icon takes Phosphor's fill weight (#345). */}
            <Icon className="h-5 w-5" weight={active ? "fill" : "regular"} />
            <span>{item.label.toLowerCase()}</span>
            {(item.badge ?? 0) > 0 && (
              <span
                aria-label={`${item.badge} unread`}
                className="absolute top-1 left-1/2 ml-1.5 h-1.5 w-1.5 rounded-full bg-accent"
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}

/**
 * The nav's main "light a flare" button: a peach circle with a ring around
 * it. Sized to stay inside the bar: the circle (44px) plus its ring fits the
 * other items' height, so it never pokes above the nav's top border (#223).
 * `icon` defaults to the flame and can be swapped, e.g. for a flare type's
 * icon when the home map suggests that type.
 */
export function NavFlareButton({
  icon: Icon = FlameIcon,
  label = "flare",
  onClick,
}: {
  icon?: Icon
  label?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex min-h-11 max-w-20 min-w-11 flex-1 items-center justify-center self-stretch active:scale-95 active:opacity-80"
    >
      <span
        data-nav-flare-circle
        className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground ring-2 ring-accent/35 ring-offset-2 ring-offset-background"
      >
        <Icon className="h-6 w-6" />
      </span>
    </button>
  )
}
