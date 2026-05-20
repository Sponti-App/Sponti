"use client"

import { useRef, useState } from "react"
import { MapView } from "@/components/map-view"
import { CalendarView } from "@/components/calendar-view"
import { BottomNav } from "@/components/bottom-nav"
import { EventDetailSheet } from "@/components/event-detail-sheet"
import { MenuDrawer } from "@/components/menu-drawer"
import { NotificationsPopover } from "@/components/notifications-popover"
import { useAuth } from "@/components/auth-provider"
import { Menu, Settings, Map, Calendar, Navigation, X } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  etaToIso,
  isImminent,
  isJoined,
  updateMyRsvp,
  type EventItem,
} from "@/lib/api/events"
import { MOCK_NOTIFICATIONS } from "@/lib/notifications"
import { haptic } from "@/lib/haptics"

export default function Home() {
  const router = useRouter()
  const [view, setView] = useState<"map" | "calendar">("map")
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [activeRoute, setActiveRoute] = useState<EventItem | null>(null)
  const [routeEta, setRouteEta] = useState<string | null>(null)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const { user } = useAuth()
  const unreadCount = notifications.filter((n) => !n.read).length

  // Left-edge swipe to open MenuDrawer
  const swipeStartX = useRef<number | null>(null)
  const SWIPE_EDGE_PX = 32   // how close to the left edge the touch must start
  const SWIPE_DIST_PX = 64   // minimum horizontal travel to trigger

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX
    swipeStartX.current = x < SWIPE_EDGE_PX ? x : null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return
    const dist = e.changedTouches[0].clientX - swipeStartX.current
    swipeStartX.current = null
    if (dist > SWIPE_DIST_PX) {
      haptic("selection")
      setMenuOpen(true)
    }
  }

  const handleOpenNotifications = () => {
    setNotificationsOpen((v) => {
      const next = !v
      if (next) {
        setNotifications((curr) => curr.map((n) => ({ ...n, read: true })))
      }
      return next
    })
  }

  const handleJoin = (event: EventItem, eta: string | null) => {
    // Optimistic UI: flip the going-badge immediately. If the PATCH fails we
    // revert below. `joinedIds` is a local overlay on top of `event.myRsvp`
    // from the API so the badge survives a refresh once the backend persists.
    setJoinedIds((prev) => {
      const next = new Set(prev)
      next.add(event.id)
      return next
    })
    // PATCH /events/:id/me — backend writes to EventMember (rsvpStatus +
    // memberWillArriveAt). The "let host know" ETA chip is the user's
    // committed arrival time; the Routes API ETA shown in the route pill is
    // separate (display-only, not persisted).
    updateMyRsvp(event.id, {
      rsvpStatus: "going",
      memberWillArriveAt: etaToIso(eta),
    }).catch((err) => {
      // Revert the optimistic add so the UI matches server state.
      console.error("[Sponti] failed to RSVP going", err)
      setJoinedIds((prev) => {
        const next = new Set(prev)
        next.delete(event.id)
        return next
      })
    })
    if (isImminent(event) && event.location.coordinates) {
      setActiveRoute(event)
      setRouteEta(null) // Routes API will fill this in via onRouteReady
      setView("map")
    }
    setSelectedEvent(null)
  }

  const handleSeeRoute = (event: EventItem) => {
    setActiveRoute(event)
    setRouteEta(null)
    setView("map")
    setSelectedEvent(null)
  }

  const handleLeave = (event: EventItem) => {
    // Optimistic remove. Same revert-on-error pattern as handleJoin.
    setJoinedIds((prev) => {
      const next = new Set(prev)
      next.delete(event.id)
      return next
    })
    // PATCH /events/:id/me with declined — backend keeps the EventMember row
    // but updates rsvpStatus, so any future invite history is preserved.
    updateMyRsvp(event.id, { rsvpStatus: "declined" }).catch((err) => {
      console.error("[Sponti] failed to RSVP declined", err)
      setJoinedIds((prev) => {
        const next = new Set(prev)
        next.add(event.id)
        return next
      })
    })
    if (activeRoute?.id === event.id) {
      setActiveRoute(null)
      setRouteEta(null)
    }
    setSelectedEvent(null)
  }

  const handleClearRoute = () => {
    setActiveRoute(null)
    setRouteEta(null)
  }

  const handleRouteReady = (event: EventItem, etaLabel: string) => {
    if (activeRoute?.id === event.id) setRouteEta(etaLabel)
  }

  return (
    <div
      className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Content Area — fills entire screen; header chips and nav float over it */}
      <div className="absolute inset-0 overflow-hidden">
        {view === "map" ? (
          <MapView
            onEventSelect={setSelectedEvent}
            activeRoute={activeRoute}
            joinedIds={joinedIds}
            onRouteReady={handleRouteReady}
            onSeeCalendar={() => setView("calendar")}
          />
        ) : (
          <CalendarView
            onEventSelect={setSelectedEvent}
            joinedIds={joinedIds}
          />
        )}

        {/* Floating header chips — overlay the map/calendar content */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {/* Hamburger pill */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => { haptic("selection"); setMenuOpen((v) => !v) }}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md transition-colors dark:bg-background/90 active:bg-background/95"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* View toggle pill */}
          <div className="pointer-events-auto flex items-center rounded-full border border-border/60 bg-background/70 p-1 shadow-sm backdrop-blur-md">
            <button
              onClick={() => { haptic("selection"); setView("map") }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                view === "map"
                  ? "bg-card text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <Map className="h-4 w-4" />
              <span>map</span>
            </button>
            <button
              onClick={() => { haptic("selection"); setView("calendar") }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                view === "calendar"
                  ? "bg-card text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>calendar</span>
            </button>
          </div>

          {/* Settings pill */}
          <button
            onClick={() => { haptic("selection"); router.push("/settings") }}
            aria-label="Settings"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md transition-colors dark:bg-background/90 active:bg-background/95"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <NotificationsPopover
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
        />

        {/* Route active pill — tap to reopen details, X to clear.
            top-16 clears the floating header chip row (~56px + gap). */}
        {activeRoute && !selectedEvent && view === "map" && (
          <div className="absolute top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent py-1.5 pr-1.5 pl-3 text-xs font-medium text-accent-foreground shadow-md">
            <button
              onClick={() => setSelectedEvent(activeRoute)}
              className="flex items-center gap-2"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>
                routing to {activeRoute.location.name}
                {routeEta ? ` · ETA ${routeEta}` : ""}
              </span>
            </button>
            <button
              onClick={handleClearRoute}
              aria-label="Clear route"
              className="ml-1 rounded-full p-1 hover:bg-accent-foreground/10"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Event Detail Sheet — vaul drawer, portal-rendered at z-50 */}
      <EventDetailSheet
        open={!!selectedEvent}
        event={selectedEvent}
        joined={selectedEvent ? isJoined(selectedEvent, joinedIds) : false}
        isHost={!!user && !!selectedEvent && selectedEvent.hostId === user.id}
        onClose={() => setSelectedEvent(null)}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onSeeRoute={handleSeeRoute}
      />

      {/* Bottom Nav — solid bar anchored to bottom (z-40) */}
      <div className="absolute right-0 bottom-0 left-0 z-40">
        <BottomNav
          onOpenNotifications={handleOpenNotifications}
          notificationsUnread={unreadCount}
        />
      </div>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
