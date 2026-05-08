"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  Clock,
  Copy,
  MapPin,
  Pencil,
  Repeat,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  type HostedEvent,
  type EventStatus,
  setLocation,
  shiftStart,
} from "@/lib/host-events"

const MIN = 60_000
const HOUR = 60 * MIN

const TIME_NUDGES = [
  { label: "-1h", delta: -HOUR },
  { label: "-30m", delta: -30 * MIN },
  { label: "+30m", delta: 30 * MIN },
  { label: "+1h", delta: HOUR },
] as const

const RECENT_PLACES = [
  { label: "the annex", detail: "rooftop bar" },
  { label: "courtyard", detail: "23 Allenby St" },
  { label: "north park", detail: "south entrance" },
  { label: "downtown loft", detail: "" },
]

function formatStart(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  if (sameDay) return `today · ${hh}:${mm}`
  if (isTomorrow) return `tomorrow · ${hh}:${mm}`
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  return `${day} · ${hh}:${mm}`
}

function timeRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return "ending"
  const m = Math.round(ms / MIN)
  if (m < 60) return `${m}m left`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? `${h}h left` : `${h}h ${rem}m left`
}

export function EventHostCard({
  event,
  status,
  onChange,
  onCancelRequest,
  onDuplicate,
}: {
  event: HostedEvent
  status: EventStatus
  // Called after any local mutation so the parent can fan out a notification.
  onChange: (kind: "time" | "location", detail: string) => void
  // Parent owns the destructive flow (modal, undo).
  onCancelRequest: () => void
  onDuplicate: () => void
}) {
  const router = useRouter()
  const [pane, setPane] = useState<null | "location" | "time">(null)
  const [locInput, setLocInput] = useState("")

  const isLive = status === "live"
  const isPast = status === "past"
  const isCancelled = status === "cancelled"

  const goingCount = event.attendingIds.length
  const inviteCount = event.attendeeIds.length

  const togglePane = (next: "location" | "time"): void => {
    setPane((curr) => (curr === next ? null : next))
    setLocInput("")
  }

  const commitLocation = (label: string, detail?: string): void => {
    setLocation(event.id, label, detail)
    onChange("location", label)
    setPane(null)
    setLocInput("")
  }

  const commitTimeShift = (delta: number, label: string): void => {
    shiftStart(event.id, delta)
    onChange("time", label)
    setPane(null)
  }

  return (
    <article
      className={`rounded-xl border p-3 flex flex-col gap-2 ${
        isCancelled
          ? "border-border bg-secondary/40 text-muted-foreground"
          : isLive
            ? "border-accent bg-accent/5"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={`text-sm font-semibold truncate ${isCancelled ? "line-through" : ""}`}
            >
              {event.title}
            </h3>
            {event.recurrence !== "none" && (
              <Repeat className="h-3 w-3 text-muted-foreground shrink-0" aria-label="recurring" />
            )}
            {isLive && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-accent text-accent-foreground rounded-full px-1.5 py-0.5">
                live
              </span>
            )}
            {isCancelled && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-destructive/15 text-destructive rounded-full px-1.5 py-0.5">
                cancelled
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {isLive ? timeRemaining(event.endAt) : formatStart(event.startAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {event.locationLabel}
              {event.locationDetail ? ` · ${event.locationDetail}` : ""}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {goingCount}/{inviteCount} going · {event.audienceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Quick action row */}
      {!isPast && !isCancelled && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
          <QuickActionButton
            icon={MapPin}
            label="location"
            active={pane === "location"}
            onClick={() => togglePane("location")}
          />
          {!isLive && (
            <QuickActionButton
              icon={Clock}
              label="time"
              active={pane === "time"}
              onClick={() => togglePane("time")}
            />
          )}
          <QuickActionButton
            icon={Pencil}
            label="edit"
            onClick={() => router.push(`/event/${event.id}/edit`)}
          />
          <div className="flex-1" />
          <QuickActionButton
            icon={X}
            label="cancel"
            destructive
            onClick={onCancelRequest}
          />
        </div>
      )}

      {(isPast || isCancelled) && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
          <QuickActionButton icon={Copy} label="duplicate" onClick={onDuplicate} />
        </div>
      )}

      {/* Inline location editor */}
      {pane === "location" && (
        <div className="rounded-lg border border-accent/30 bg-background p-2 flex flex-col gap-2">
          <Input
            placeholder="search a place…"
            value={locInput}
            onChange={(e) => setLocInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && locInput.trim()) commitLocation(locInput.trim())
            }}
          />
          <div className="flex flex-col gap-0.5">
            {RECENT_PLACES.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => commitLocation(p.label, p.detail || undefined)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary text-left"
              >
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs">{p.label}</span>
                {p.detail && (
                  <span className="text-[10px] text-muted-foreground truncate">{p.detail}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline time shifter */}
      {pane === "time" && (
        <div className="rounded-lg border border-accent/30 bg-background p-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TIME_NUDGES.map((n) => (
              <button
                key={n.label}
                type="button"
                onClick={() => commitTimeShift(n.delta, n.label)}
                className="px-3 py-1.5 rounded-full border border-border bg-background text-xs hover:bg-secondary"
              >
                {n.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push(`/event/${event.id}/edit`)}
              className="px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground"
            >
              set new time…
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            attendees get notified about the shift
          </p>
        </div>
      )}
    </article>
  )
}

function QuickActionButton({
  icon: Icon,
  label,
  active,
  destructive,
  onClick,
}: {
  icon: typeof MapPin
  label: string
  active?: boolean
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-8 px-2.5 rounded-full text-xs ${
        active ? "bg-accent/10 text-accent" : ""
      } ${destructive ? "text-destructive hover:text-destructive" : ""}`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "" : "mr-0"}`} />
      <span>{label}</span>
    </Button>
  )
}

// re-export for external use, since some consumers want the Check icon to
// indicate completion in toasts.
export { Check }
