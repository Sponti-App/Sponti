"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Drawer } from "vaul"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { FlareActions, FlareFacts, FlareHeader } from "@/components/flare-detail"
import { ChevronRight, Navigation, Pencil } from "lucide-react"
import {
  arrivalStatusLabel,
  avatarText,
  distanceFromUser,
  eventCoords,
  formatArrivalStatus,
  type EventItem,
} from "@/lib/api/events"
import {
  etaAvailable,
  flareStatusLine,
  flareTiming,
  flareViewer,
  googleMapsUrl,
} from "@/lib/flare-detail"
import { readLastKnownCoords } from "@/lib/geolocation"
import { haptic } from "@/lib/haptics"

interface Props {
  open: boolean
  event: EventItem | null
  joined: boolean
  isHost?: boolean
  onClose: () => void
  onJoin: (event: EventItem, eta: string | null) => void
  onLeave: (event: EventItem) => void
  onSeeRoute: (event: EventItem) => void
}

export function EventDetailSheet({
  open,
  event,
  joined,
  isHost = false,
  onClose,
  onJoin,
  onLeave,
  onSeeRoute,
}: Props) {
  const router = useRouter()
  const [selectedEta, setSelectedEta] = useState<string | null>(null)

  // Keep showing the last non-null event while vaul animates the drawer closed.
  const [displayEvent, setDisplayEvent] = useState<EventItem | null>(event)
  useEffect(() => {
    if (event) {
      // Resets the sheet's local "last shown" state to track the incoming
      // prop; the rule only flags this first setState call in the effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayEvent(event)
      setSelectedEta(null)
    }
  }, [event])

  // Haptic on open
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) haptic("light")
    prevOpen.current = open
  }, [open])

  const { user } = useAuth()
  // Same rules as the full page (#139): who's looking picks the main action,
  // and an arrival time is only asked for when live or starting within 1h.
  const viewer = flareViewer({
    isHost,
    myRsvp: joined ? "going" : displayEvent?.myRsvp,
  })
  const timing = displayEvent
    ? flareTiming({ startAt: displayEvent.startAt, endAt: displayEvent.endAt })
    : "later"
  const withEta = etaAvailable(timing)
  const distance = displayEvent
    ? distanceFromUser(displayEvent, readLastKnownCoords())
    : null

  // The full flare page holds the thread and the host's arrival board. Close
  // the drawer first so vaul's body scroll lock doesn't leak into it (#168).
  const openFlarePage = (query = "") => {
    if (!displayEvent) return
    onClose()
    router.push(`/event/${displayEvent.id}${query}`)
  }

  const hostLabel = user && displayEvent?.host?.id === user.id
    ? "hosted by you"
    : `hosted by ${(displayEvent?.host?.name || "host").toLowerCase()}`

  // The api only sends willArriveAt/arrivalStatus on attendee rows to the
  // flare's host, so this is naturally empty for anyone else — no separate
  // client-side check needed beyond the isHost render guard below.
  const attendeesWithArrival = (displayEvent?.attendees ?? []).filter(
    (a) => a.willArriveAt || a.arrivalStatus
  )

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          haptic("light")
          onClose()
        }
      }}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) outline-none">
          {/* Drag handle — vaul attaches its gesture here automatically */}
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <Drawer.Title className="sr-only">
            {displayEvent?.title ?? "Flare details"}
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            event details and rsvp
          </Drawer.Description>

          {displayEvent && (
            <div className="max-h-[62vh] overflow-y-auto px-4 pb-6" data-vaul-no-drag>
              <FlareHeader
                as="h2"
                type={displayEvent.type}
                title={displayEvent.title}
                statusLine={flareStatusLine(displayEvent, timing)}
                timing={timing}
                viewer={viewer}
              />

              <div className="my-4">
                <FlareFacts
                  when={formatWhen(displayEvent.startAt, timing === "live")}
                  until={`until ${formatClock(displayEvent.endAt)}`}
                  placeName={displayEvent.location.name}
                  placeDetail={
                    [
                      distance?.label,
                      displayEvent.location.area ?? displayEvent.location.address,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                  mapsUrl={googleMapsUrl({
                    coordinates: eventCoords(displayEvent),
                    name: displayEvent.location.name,
                  })}
                />
              </div>

              {/* Host Note */}
              <Card className="mb-4 border-0 bg-muted p-3">
                <div className="flex items-start gap-2">
                  {displayEvent.host.avatarUrl ? (
                    // Static export (required for the Capacitor iOS/Android wrapper) can't
                    // use next/image's server-side optimizer, and host avatar URLs are
                    // arbitrary/remote, so a plain <img> is intentional here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayEvent.host.avatarUrl}
                      alt={displayEvent.host.name}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${displayEvent.host.color} ${avatarText(
                        displayEvent.host.color
                      )}`}
                    >
                      {displayEvent.host.avatar || displayEvent.host.name?.charAt(0).toUpperCase() || "H"}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="truncate text-sm font-medium">{hostLabel}</div>

                    {displayEvent.host.note ? (
                      <div className="mt-0.5 text-sm text-muted-foreground">{displayEvent.host.note}</div>
                    ) : null}
                  </div>
                </div>
              </Card>

              {/* Who's Going */}
              <div className="mb-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  who&apos;s going
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {displayEvent.attendees.map((a, i) => (
                      <div
                        key={i}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs ${a.color} ${avatarText(a.color)}`}
                      >
                        {a.avatar || a.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium">
                      {displayEvent.attendees.map((a) => a.name.toLowerCase()).join(", ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {displayEvent.going} going
                    </p>
                  </div>
                </div>

                {/* Attendee arrival answers — host only; the api only sends
                    willArriveAt/arrivalStatus to the host in the first place. */}
                {isHost && attendeesWithArrival.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {attendeesWithArrival.map((a, i) => (
                      <div
                        key={a.id ?? i}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <span>{a.name}</span>
                        <span
                          className={
                            a.arrivalStatus === "running_late"
                              ? "font-medium text-accent"
                              : undefined
                          }
                        >
                          {a.willArriveAt
                            ? formatArrivalStatus(a.willArriveAt)
                            : a.arrivalStatus
                              ? arrivalStatusLabel(a.arrivalStatus)
                              : null}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <FlareActions
                viewer={viewer}
                timing={timing}
                declined={!joined && displayEvent.myRsvp === "declined"}
                eta={selectedEta}
                onEtaChange={(eta) => {
                  haptic("selection")
                  setSelectedEta(eta)
                }}
                onJoin={() => {
                  haptic("success")
                  onJoin(displayEvent, withEta ? selectedEta : null)
                }}
                onDecline={() => {
                  haptic("warning")
                  onLeave(displayEvent)
                }}
                onShareUpdate={() => {
                  haptic("selection")
                  openFlarePage("?tab=updates&compose=1")
                }}
              />

              <div className="mt-2 flex flex-col gap-1">
                {viewer === "joined" && withEta && eventCoords(displayEvent) && (
                  <SecondaryAction
                    onClick={() => {
                      haptic("medium")
                      onSeeRoute(displayEvent)
                    }}
                  >
                    <Navigation className="h-4 w-4" /> see route on map
                  </SecondaryAction>
                )}
                {viewer === "joined" && withEta && (
                  <SecondaryAction
                    onClick={() => {
                      haptic("warning")
                      onLeave(displayEvent)
                    }}
                  >
                    can&apos;t make it
                  </SecondaryAction>
                )}
                {viewer === "host" && (
                  <SecondaryAction onClick={() => openFlarePage("/edit")}>
                    <Pencil className="h-4 w-4" /> edit flare
                  </SecondaryAction>
                )}
                <SecondaryAction onClick={() => openFlarePage()}>
                  {viewer === "invited" ? "see details and updates" : "open flare"}
                  <ChevronRight className="h-4 w-4" />
                </SecondaryAction>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function SecondaryAction({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      className="h-10 w-full rounded-full text-sm text-muted-foreground"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function formatWhen(startIso: string, live: boolean): string {
  const start = new Date(startIso)
  if (live) return `now · ${formatClock(startIso)}`
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const day =
    start.toDateString() === today.toDateString()
      ? "today"
      : start.toDateString() === tomorrow.toDateString()
        ? "tomorrow"
        : start
            .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
            .toLowerCase()
  return `${day} · ${formatClock(startIso)}`
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  const hour = d.getHours() % 12 || 12
  const minute = String(d.getMinutes()).padStart(2, "0")
  return `${hour}:${minute}${d.getHours() >= 12 ? "pm" : "am"}`
}
