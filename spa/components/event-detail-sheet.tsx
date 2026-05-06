"use client"

import { useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Coffee, Users, Activity, Flame, Check, Navigation, X } from "lucide-react"
import { avatarText, isImminent } from "@/lib/events"
import type { EventItem } from "@/lib/events"

const ETA_OPTIONS = ["5 min", "15 min", "30 min", "1 hr"]

function EventTypeIcon({ type }: { type: EventItem["type"] }) {
  const cls = "w-6 h-6 text-brand"
  if (type === "coffee") return <Coffee className={cls} />
  if (type === "run") return <Activity className={cls} />
  return <Users className={cls} />
}

interface Props {
  event: EventItem
  joined: boolean
  onClose: () => void
  onJoin: (event: EventItem, eta: string | null) => void
  onLeave: (event: EventItem) => void
  onSeeRoute: (event: EventItem) => void
}

export function EventDetailSheet({ event, joined, onClose, onJoin, onLeave, onSeeRoute }: Props) {
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
      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="px-4 pb-6 overflow-y-auto max-h-[62vh]">
          {/* Event Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
              <EventTypeIcon type={event.type} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{event.title}</h2>
              <div className="flex items-center gap-1 text-brand text-sm">
                <Flame className="w-4 h-4" />
                <span>{event.status}</span>
              </div>
            </div>
            {joined && (
              <span className="flex items-center gap-1 text-xs font-medium bg-brand/10 text-brand px-2 py-1 rounded-full self-start">
                <Check className="w-3 h-3" /> going
              </span>
            )}
          </div>

          {/* Host Note */}
          <Card className="p-3 mb-4 bg-muted border-0">
            <div className="flex items-start gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${event.host.color} ${avatarText(event.host.color)}`}
              >
                {event.host.avatar}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{event.host.name} · host note</p>
                <p className="text-sm italic">{event.host.note}</p>
              </div>
            </div>
          </Card>

          {/* Where */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Where</span>
              <span className="text-xs text-muted-foreground">{event.location.walkTime}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
                <MapPin className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{event.location.name}</p>
                <p className="text-sm text-muted-foreground">
                  {event.location.area} · {event.location.distance} · {event.location.walkTime}
                </p>
              </div>
            </div>
          </div>

          {/* Who's Going */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Who&apos;s going
            </p>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {event.attendees.map((a, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 border-background ${a.color} ${avatarText(a.color)}`}
                  >
                    {a.avatar}
                  </div>
                ))}
              </div>
              <div>
                <p className="font-medium">{event.attendees.map((a) => a.name).join(", ")}</p>
                <p className="text-sm text-muted-foreground">{event.going} going</p>
              </div>
            </div>
          </div>

          {/* ETA Selection — imminent + not yet joined */}
          {imminent && !joined && (
            <div className="mb-6">
              <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
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
                        ? "bg-brand text-brand-foreground hover:bg-brand/90"
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
          {joined ? (
            <div className="space-y-2">
              {imminent && event.position && (
                <Button
                  className="w-full rounded-full py-6 text-base bg-brand text-brand-foreground hover:bg-brand/90"
                  onClick={() => onSeeRoute(event)}
                >
                  <Navigation className="w-4 h-4 mr-1" />
                  see route on map
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full rounded-full py-6 text-base"
                onClick={() => onLeave(event)}
              >
                <X className="w-4 h-4 mr-1" />
                {imminent ? "can't make it" : "leave event"}
              </Button>
            </div>
          ) : imminent ? (
            <Button
              className={`w-full rounded-full py-6 text-base ${
                selectedEta
                  ? "bg-brand text-brand-foreground hover:bg-brand/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
              disabled={!selectedEta}
              onClick={() => selectedEta && onJoin(event, selectedEta)}
            >
              {selectedEta ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> on the way · {selectedEta}
                </span>
              ) : (
                "select ETA to join"
              )}
            </Button>
          ) : (
            <Button
              className="w-full rounded-full py-6 text-base bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={() => onJoin(event, null)}
            >
              <Check className="w-4 h-4 mr-1" />
              I&apos;m in
              {event.calendarTime ? ` · ${event.calendarTime}` : ""}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
