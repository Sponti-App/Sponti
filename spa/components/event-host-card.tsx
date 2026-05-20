"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Clock, MapPin, Pencil, RotateCcw, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type HostedEvent, type EventStatus } from "@/lib/api/events"

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
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
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
  canManage = false,
  onChange,
  onCancelRequest,
  onReactivate,
  onAcceptInvite,
  onDeclineInvite,
  responsePending = false,
  onLocationChange,
  onTimeShift,
}: {
  event: HostedEvent
  status: EventStatus
  canManage?: boolean
  onChange?: (kind: "time" | "location", detail: string) => void
  onCancelRequest?: () => void
  onReactivate?: () => void
  onAcceptInvite?: () => void
  onDeclineInvite?: () => void
  responsePending?: boolean
  onLocationChange?: (
    locationLabel: string,
    locationDetail?: string
  ) => Promise<void> | void
  onTimeShift?: (deltaMs: number, label: string) => Promise<void> | void
}) {
  const router = useRouter()
  const [pane, setPane] = useState<null | "location" | "time">(null)
  const [locInput, setLocInput] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isLive = status === "live"
  const isPast = status === "past"
  const isCancelled = status === "cancelled"
  const canRespond = Boolean(onAcceptInvite || onDeclineInvite)

  const goingCount = event.attendingCount
  const inviteCount = event.attendeeCount

  const togglePane = (next: "location" | "time"): void => {
    setPane((curr) => (curr === next ? null : next))
    setLocInput("")
  }

  const commitLocation = async (
    label: string,
    detail?: string
  ): Promise<void> => {
    if (!onLocationChange) return
    try {
      setActionError(null)
      setIsSaving(true)
      await onLocationChange(label, detail)
      onChange?.("location", label)
      setPane(null)
      setLocInput("")
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update location"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const commitTimeShift = async (
    delta: number,
    label: string
  ): Promise<void> => {
    if (!onTimeShift) return
    try {
      setActionError(null)
      setIsSaving(true)
      await onTimeShift(delta, label)
      onChange?.("time", label)
      setPane(null)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update time"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article
      className={`flex flex-col gap-2 rounded-xl border p-3 ${
        isCancelled
          ? "border-border bg-secondary/40 text-muted-foreground"
          : isLive
            ? "border-accent bg-accent/5"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={`truncate text-sm font-semibold ${isCancelled ? "line-through" : ""}`}
            >
              {event.title}
            </h3>
            {isLive && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent-foreground uppercase">
                live
              </span>
            )}
            {isCancelled && (
              <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-destructive uppercase">
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

      {actionError && (
        <p className="text-[11px] text-destructive">{actionError}</p>
      )}

      {canManage && !isPast && !isCancelled && (
        <div className="flex items-center gap-1.5 border-t border-border/60 pt-1">
          <QuickActionButton
            icon={MapPin}
            label="location"
            active={pane === "location"}
            disabled={isSaving}
            onClick={() => togglePane("location")}
          />
          {!isLive && (
            <QuickActionButton
              icon={Clock}
              label="time"
              active={pane === "time"}
              disabled={isSaving}
              onClick={() => togglePane("time")}
            />
          )}
          <QuickActionButton
            icon={Pencil}
            label="edit"
            disabled={isSaving}
            onClick={() => router.push(`/event/${event.id}/edit`)}
          />
          <div className="flex-1" />
          <QuickActionButton
            icon={X}
            label="cancel"
            destructive
            disabled={isSaving}
            onClick={() => onCancelRequest?.()}
          />
        </div>
      )}

      {canManage && isCancelled && !isPast && (
        <div className="flex items-center gap-1.5 border-t border-border/60 pt-1">
          <QuickActionButton
            icon={RotateCcw}
            label="reactivate"
            disabled={isSaving}
            onClick={() => onReactivate?.()}
          />
        </div>
      )}

      {canRespond && !isPast && !isCancelled && (
        <div className="flex items-center gap-2 border-t border-border/60 pt-2">
          <Button
            type="button"
            size="sm"
            disabled={responsePending}
            onClick={() => onAcceptInvite?.()}
            className="h-8 flex-1 rounded-full bg-accent px-3 text-xs text-accent-foreground hover:bg-accent/90"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            going
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={responsePending}
            onClick={() => onDeclineInvite?.()}
            className="h-8 flex-1 rounded-full px-3 text-xs"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            decline
          </Button>
        </div>
      )}

      {/* Inline location editor */}
      {pane === "location" && (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-background p-2">
          <Input
            placeholder="search a place…"
            value={locInput}
            onChange={(e) => setLocInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && locInput.trim())
                void commitLocation(locInput.trim())
            }}
          />
          <div className="flex flex-col gap-0.5">
            {RECENT_PLACES.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  void commitLocation(p.label, p.detail || undefined)
                }
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary"
              >
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs">{p.label}</span>
                {p.detail && (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {p.detail}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline time shifter */}
      {pane === "time" && (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-background p-2">
          <div className="flex flex-wrap gap-1.5">
            {TIME_NUDGES.map((n) => (
              <button
                key={n.label}
                type="button"
                onClick={() => void commitTimeShift(n.delta, n.label)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
              >
                {n.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push(`/event/${event.id}/edit`)}
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              set new time…
            </button>
          </div>
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
  disabled,
  onClick,
}: {
  icon: typeof MapPin
  label: string
  active?: boolean
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 rounded-full px-2.5 text-xs ${
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
