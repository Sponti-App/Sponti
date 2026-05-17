"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Drawer } from "vaul"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Coffee,
  Users,
  Activity,
  Flame,
  Check,
  Navigation,
  X,
} from "lucide-react"
import {
  avatarText,
  eventCoords,
  formatEventTime,
  formatRelativeStatus,
  isImminent,
  type EventItem,
} from "@/lib/api/events"
import { haptic } from "@/lib/haptics"

const ETA_OPTIONS = ["5 min", "15 min", "30 min", "1 hr"]

function EventTypeIcon({ type }: { type: EventItem["type"] }) {
  const cls = "w-6 h-6 text-accent"
  if (type === "drinks") return <Coffee className={cls} />
  if (type === "sports") return <Activity className={cls} />
  return <Users className={cls} />
}

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
      setDisplayEvent(event)
      setSelectedEta(null) // reset ETA picker each time a new event opens
    }
  }, [event])

  // Haptic on open
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) haptic("light")
    prevOpen.current = open
  }, [open])

  const imminent = displayEvent ? isImminent(displayEvent) : false

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
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.12)] outline-none">
          {/* Drag handle — vaul attaches its gesture here automatically */}
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <Drawer.Title className="sr-only">
            {displayEvent?.title ?? "Flare details"}
          </Drawer.Title>

          {displayEvent && (
            <div className="max-h-[62vh] overflow-y-auto px-4 pb-6" data-vaul-no-drag>
              {/* Event Header */}
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <EventTypeIcon type={displayEvent.type} />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{displayEvent.title}</h2>
                  <div className="flex items-center gap-1 text-sm text-accent">
                    <Flame className="h-4 w-4" />
                    <span>{formatRelativeStatus(displayEvent)}</span>
                  </div>
                </div>
                {joined && (
                  <span className="flex items-center gap-1 self-start rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                    <Check className="h-3 w-3" /> going
                  </span>
                )}
              </div>

              {/* Host Note */}
              <Card className="mb-4 border-0 bg-muted p-3">
                <div className="flex items-start gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${displayEvent.host.color} ${avatarText(displayEvent.host.color)}`}
                  >
                    {displayEvent.host.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {displayEvent.host.name} · host note
                    </p>
                    <p className="text-sm italic">{displayEvent.host.note}</p>
                  </div>
                </div>
              </Card>

              {/* Where */}
              <div className="mb-4">
                <span className="mb-2 block text-xs tracking-wide text-muted-foreground uppercase">
                  Where
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{displayEvent.location.name}</p>
                    {(displayEvent.location.area || displayEvent.location.address) && (
                      <p className="truncate text-sm text-muted-foreground">
                        {displayEvent.location.area ?? displayEvent.location.address}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Who's Going */}
              <div className="mb-4">
                <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                  Who&apos;s going
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {displayEvent.attendees.map((a, i) => (
                      <div
                        key={i}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs ${a.color} ${avatarText(a.color)}`}
                      >
                        {a.avatar}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium">
                      {displayEvent.attendees.map((a) => a.name).join(", ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {displayEvent.going} going
                    </p>
                  </div>
                </div>
              </div>

              {/* ETA Selection — imminent + not yet joined + not host */}
              {imminent && !joined && !isHost && (
                <div className="mb-6">
                  <span className="mb-2 block text-xs tracking-wide text-muted-foreground uppercase">
                    Let host know
                  </span>
                  <div className="flex gap-2">
                    {ETA_OPTIONS.map((eta) => (
                      <Button
                        key={eta}
                        variant={selectedEta === eta ? "default" : "outline"}
                        size="sm"
                        className={`flex-1 rounded-full ${
                          selectedEta === eta
                            ? "bg-accent text-accent-foreground hover:bg-accent/90"
                            : "bg-background text-foreground"
                        }`}
                        onClick={() => {
                          haptic("selection")
                          setSelectedEta(eta)
                        }}
                      >
                        {eta}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              {isHost ? (
                <Button
                  className="w-full rounded-full bg-accent py-6 text-base text-accent-foreground hover:bg-accent/90"
                  onClick={() => router.push(`/event/${displayEvent.id}/edit`)}
                >
                  edit flare
                </Button>
              ) : joined ? (
                <div className="space-y-2">
                  {imminent && eventCoords(displayEvent) && (
                    <Button
                      className="w-full rounded-full bg-accent py-6 text-base text-accent-foreground hover:bg-accent/90"
                      onClick={() => {
                        haptic("medium")
                        onSeeRoute(displayEvent)
                      }}
                    >
                      <Navigation className="mr-1 h-4 w-4" />
                      see route on map
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full rounded-full py-6 text-base"
                    onClick={() => {
                      haptic("warning")
                      onLeave(displayEvent)
                    }}
                  >
                    <X className="mr-1 h-4 w-4" />
                    {imminent ? "can't make it" : "leave event"}
                  </Button>
                </div>
              ) : imminent ? (
                <Button
                  className={`w-full rounded-full py-6 text-base ${
                    selectedEta
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : "cursor-not-allowed bg-muted text-muted-foreground"
                  }`}
                  disabled={!selectedEta}
                  onClick={() => {
                    if (selectedEta) {
                      haptic("success")
                      onJoin(displayEvent, selectedEta)
                    }
                  }}
                >
                  {selectedEta ? (
                    <span className="flex items-center gap-2">
                      <Check className="h-4 w-4" /> on the way · {selectedEta}
                    </span>
                  ) : (
                    "select ETA to join"
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full rounded-full bg-accent py-6 text-base text-accent-foreground hover:bg-accent/90"
                  onClick={() => {
                    haptic("success")
                    onJoin(displayEvent, null)
                  }}
                >
                  <Check className="mr-1 h-4 w-4" />
                  I&apos;m in
                  {` · ${formatEventTime(displayEvent)}`}
                </Button>
              )}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
