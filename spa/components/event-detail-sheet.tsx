"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
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

const ETA_OPTIONS = ["5 min", "15 min", "30 min", "1 hr"]

function EventTypeIcon({ type }: { type: EventItem["type"] }) {
  const cls = "w-6 h-6 text-accent"
  if (type === "drinks") return <Coffee className={cls} />
  if (type === "sports") return <Activity className={cls} />
  return <Users className={cls} />
}

interface Props {
  event: EventItem
  joined: boolean
  isHost?: boolean
  onClose: () => void
  onJoin: (event: EventItem, eta: string | null) => void
  onLeave: (event: EventItem) => void
  onSeeRoute: (event: EventItem) => void
}

export function EventDetailSheet({
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
  const dragStartY = useRef<number | null>(null)
  const imminent = isImminent(event)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return
    const delta = e.clientY - dragStartY.current
    dragStartY.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // pointer may already be released
    }
    if (delta > 60) onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <button
        aria-label="Close event details"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />

      {/* Sheet */}
      <div className="absolute right-0 bottom-0 left-0 rounded-t-3xl bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        {/* Drag handle */}
        <div
          className="flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-4 pb-6">
          {/* Event Header */}
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <EventTypeIcon type={event.type} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{event.title}</h2>
              <div className="flex items-center gap-1 text-sm text-accent">
                <Flame className="h-4 w-4" />
                <span>{formatRelativeStatus(event)}</span>
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
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${event.host.color} ${avatarText(event.host.color)}`}
              >
                {event.host.avatar}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {event.host.name} · host note
                </p>
                <p className="text-sm italic">{event.host.note}</p>
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
                <p className="truncate font-medium">{event.location.name}</p>
                {(event.location.area || event.location.address) && (
                  <p className="truncate text-sm text-muted-foreground">
                    {event.location.area ?? event.location.address}
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
                {event.attendees.map((a, i) => (
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
                  {event.attendees.map((a) => a.name).join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {event.going} going
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
                    onClick={() => setSelectedEta(eta)}
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
              onClick={() => router.push(`/event/${event.id}/edit`)}
            >
              edit flare
            </Button>
          ) : joined ? (
            <div className="space-y-2">
              {imminent && eventCoords(event) && (
                <Button
                  className="w-full rounded-full bg-accent py-6 text-base text-accent-foreground hover:bg-accent/90"
                  onClick={() => onSeeRoute(event)}
                >
                  <Navigation className="mr-1 h-4 w-4" />
                  see route on map
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full rounded-full py-6 text-base"
                onClick={() => onLeave(event)}
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
              onClick={() => selectedEta && onJoin(event, selectedEta)}
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
              onClick={() => onJoin(event, null)}
            >
              <Check className="mr-1 h-4 w-4" />
              I&apos;m in
              {` · ${formatEventTime(event)}`}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
