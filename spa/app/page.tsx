"use client"

import { useState } from "react"
import { MapView } from "@/components/map-view"
import { CalendarView } from "@/components/calendar-view"
import { BottomNav } from "@/components/bottom-nav"
import { EventDetailSheet } from "@/components/event-detail-sheet"
import { NotificationsPopover } from "@/components/notifications-popover"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bell, Map, Calendar, Navigation, X } from "lucide-react"
import { isImminent } from "@/lib/events"
import type { EventItem } from "@/lib/events"
import { MOCK_NOTIFICATIONS } from "@/lib/notifications"

export default function Home() {
  const [view, setView] = useState<"map" | "calendar">("map")
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [activeRoute, setActiveRoute] = useState<EventItem | null>(null)
  const [routeEta, setRouteEta] = useState<string | null>(null)
  const [joinedIds, setJoinedIds] = useState<Set<number>>(() => new Set())
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const unreadCount = notifications.filter((n) => !n.read).length

  const handleJoin = (event: EventItem, eta: string | null) => {
    setJoinedIds((prev) => {
      const next = new Set(prev)
      next.add(event.id)
      return next
    })
    if (isImminent(event) && event.position) {
      setActiveRoute(event)
      setRouteEta(eta)
      setView("map")
    }
    setSelectedEvent(null)
  }

  const handleSeeRoute = (event: EventItem) => {
    setActiveRoute(event)
    setView("map")
    setSelectedEvent(null)
  }

  const handleLeave = (event: EventItem) => {
    setJoinedIds((prev) => {
      const next = new Set(prev)
      next.delete(event.id)
      return next
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Mobile Frame */}
      <div className="w-[390px] h-[844px] bg-background rounded-[40px] border-[8px] border-foreground relative overflow-hidden flex flex-col">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2">
          <span className="text-sm font-medium">9:41</span>
          <div className="w-[80px] h-[24px] bg-foreground rounded-full" />
          <div className="flex items-center gap-1">
            <span className="text-xs">•••</span>
            <span className="text-xs">◗</span>
            <span className="text-xs">▌</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-accent text-accent-foreground text-sm font-medium">
              M
            </AvatarFallback>
          </Avatar>

          {/* Toggle */}
          <div className="flex items-center border border-foreground rounded-full p-1">
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                view === "map" ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <Map className="h-4 w-4" />
              <span>map</span>
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
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
                  setNotifications((curr) => curr.map((n) => ({ ...n, read: true })))
                }
                return next
              })
            }}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            className="relative h-9 w-9 rounded-full border border-foreground flex items-center justify-center"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread`}
                className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center"
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
        <div className="flex-1 relative overflow-hidden">
          {view === "map" ? (
            <MapView
              onEventSelect={setSelectedEvent}
              activeRoute={activeRoute}
              joinedIds={joinedIds}
            />
          ) : (
            <CalendarView onEventSelect={setSelectedEvent} joinedIds={joinedIds} />
          )}

          {/* Route active pill — tap to reopen details, X to clear */}
          {activeRoute && !selectedEvent && view === "map" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-accent text-accent-foreground pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium shadow-md">
              <button
                onClick={() => setSelectedEvent(activeRoute)}
                className="flex items-center gap-2"
              >
                <Navigation className="w-3.5 h-3.5" />
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
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Event Detail Sheet — covers content + nav when open (z-50) */}
        {selectedEvent && (
          <div className="absolute inset-0 z-50">
            <EventDetailSheet
              event={selectedEvent}
              joined={joinedIds.has(selectedEvent.id)}
              onClose={() => setSelectedEvent(null)}
              onJoin={handleJoin}
              onLeave={handleLeave}
              onSeeRoute={handleSeeRoute}
            />
          </div>
        )}

        {/* Bottom Nav — floats over content (z-40) */}
        <div className="absolute bottom-6 left-0 right-0 z-40 pointer-events-none">
          <div className="pointer-events-auto">
            <BottomNav />
          </div>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <div className="w-32 h-1 bg-foreground rounded-full" />
        </div>
      </div>
    </div>
  )
}
