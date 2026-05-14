"use client"

import { useState } from "react"
import { MapView } from "@/components/map-view"
import { CalendarView } from "@/components/calendar-view"
import { BottomNav } from "@/components/bottom-nav"
import { EventDetailSheet } from "@/components/event-detail-sheet"
import { MenuDrawer } from "@/components/menu-drawer"
import { NotificationsPopover } from "@/components/notifications-popover"
import { HomeTour } from "@/components/home-tour"
import { useAuth } from "@/components/auth-provider"
import { AccountAvatar } from "@/components/account-avatar"
import { Bell, Map, Calendar, Navigation, X } from "lucide-react"
import {
  etaToIso,
  isImminent,
  isJoined,
  updateMyRsvp,
  type EventItem,
} from "@/lib/api/events"
import { MOCK_NOTIFICATIONS } from "@/lib/notifications"

export default function Home() {
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
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="relative z-30 rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <AccountAvatar
            user={user}
            className="h-9 w-9"
            fallbackClassName="bg-accent text-sm font-medium text-accent-foreground"
          />
        </button>

        {/* Toggle */}
        <div className="flex items-center rounded-full border border-foreground p-1">
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              view === "map" ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <Map className="h-4 w-4" />
            <span>map</span>
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              view === "calendar" ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>calendar</span>
          </button>
        </div>

        <button
          onClick={() => {
            setNotificationsOpen((v) => {
              const next = !v
              if (next) {
                setNotifications((curr) =>
                  curr.map((n) => ({ ...n, read: true }))
                )
              }
              return next
            })
          }}
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread`}
              className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground"
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <NotificationsPopover
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
      />

      {/* Content Area — fills all remaining height; nav floats over it */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {view === "map" ? (
          <MapView
            onEventSelect={setSelectedEvent}
            activeRoute={activeRoute}
            joinedIds={joinedIds}
            onRouteReady={handleRouteReady}
          />
        ) : (
          <CalendarView
            onEventSelect={setSelectedEvent}
            joinedIds={joinedIds}
          />
        )}

        {/* Route active pill — tap to reopen details, X to clear */}
        {activeRoute && !selectedEvent && view === "map" && (
          <div className="absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent py-1.5 pr-1.5 pl-3 text-xs font-medium text-accent-foreground shadow-md">
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

      {/* Event Detail Sheet — covers content + nav when open (z-50) */}
      {selectedEvent && (
        <div className="absolute inset-0 z-50">
          <EventDetailSheet
            event={selectedEvent}
            joined={isJoined(selectedEvent, joinedIds)}
            onClose={() => setSelectedEvent(null)}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onSeeRoute={handleSeeRoute}
          />
        </div>
      )}

      {/* Bottom Nav — floats over content (z-40) */}
      <div className="pointer-events-none absolute right-0 bottom-6 left-0 z-40">
        <div className="pointer-events-auto">
          <BottomNav />
        </div>
      </div>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <HomeTour user={user} onViewChange={setView} />
    </div>
  )
}
