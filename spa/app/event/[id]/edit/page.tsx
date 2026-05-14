"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Pencil, Trash2 } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CancelEventDialog } from "@/components/cancel-event-dialog"
import {
  RecurringScopeModal,
  type RecurringScope,
} from "@/components/recurring-scope-modal"
import { useAuth } from "@/components/auth-provider"
import {
  cancelHostedEvent,
  deriveStatus,
  getHostedEvent,
  inferEventStartShape,
  updateHostedEvent,
  useHostedEvents,
  type HostedEvent,
  type Recurrence,
} from "@/lib/api/events"
import { MOCK_NOTIFICATIONS, pushEventUpdate, type Notification } from "@/lib/notifications"

const DURATION_OPTIONS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
] as const

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "none", label: "no repeat" },
  { value: "daily", label: "daily" },
  { value: "weekly", label: "weekly" },
]

const RECENT_PLACES = [
  { label: "the annex", detail: "rooftop bar" },
  { label: "courtyard", detail: "23 Allenby St" },
  { label: "north park", detail: "south entrance" },
  { label: "downtown loft", detail: "" },
]

const MIN = 60_000

export default function EventEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const events = useHostedEvents()
  const [, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)

  const event = events.find((e) => e.id === params.id) ?? getHostedEvent(params.id)

  // We snapshot the original once on mount via lazy init so we can diff
  // against the live event for the save-summary. If the event evaporates
  // (e.g. cancelled in another tab) we fall back to the latest snapshot.
  const [original] = useState<HostedEvent | null>(event ?? null)

  const initialShape = original ? inferEventStartShape(original) : null
  const [title, setTitle] = useState(original?.title ?? "")
  const [startDate, setStartDate] = useState(initialShape?.startDate ?? "")
  const [startTime, setStartTime] = useState(initialShape?.startTime ?? "")
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initialShape?.durationMinutes ?? 60,
  )
  const [recurrence, setRecurrence] = useState<Recurrence>(original?.recurrence ?? "none")
  const [locationLabel, setLocationLabel] = useState(original?.locationLabel ?? "")
  const [locationDetail, setLocationDetail] = useState(original?.locationDetail ?? "")

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [scopeNeeded, setScopeNeeded] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)

  if (!event || !original) {
    return (
      <FrameMissing onBack={() => router.push("/event")} />
    )
  }

  const status = deriveStatus(event)
  const isLive = status === "live"
  const isPast = status === "past"
  const hostName = user?.displayName ?? "you"

  // Derive next start/end ISO strings from form state. For "now" mode events,
  // we keep the original start since shifting via this form would be confusing
  // — the quick-action time chips on the hub card handle that case.
  const nextStartAt =
    initialShape?.mode === "scheduled" && startDate && startTime
      ? new Date(`${startDate}T${startTime}`).toISOString()
      : original.startAt
  const nextEndAt = new Date(
    new Date(nextStartAt).getTime() + durationMinutes * MIN,
  ).toISOString()

  const titleChanged = title.trim() !== original.title
  const timeChanged =
    nextStartAt !== original.startAt ||
    durationMinutes !==
      Math.round(
        (new Date(original.endAt).getTime() -
          new Date(original.startAt).getTime()) /
          MIN,
      )
  const locationChanged =
    locationLabel.trim() !== original.locationLabel ||
    (locationDetail.trim() || undefined) !== original.locationDetail
  const recurrenceChanged = recurrence !== original.recurrence

  const dirty = titleChanged || timeChanged || locationChanged || recurrenceChanged
  const willNotifyAttendees = (timeChanged || locationChanged) && event.attendeeIds.length > 0

  const fan = (
    change: "time" | "location" | "cancelled",
    detail?: string,
  ): void => {
    setNotifications((prev) =>
      pushEventUpdate(prev, {
        actorName: hostName,
        eventTitle: title.trim() || original.title,
        change,
        detail,
      }),
    )
  }

  const persistChanges = (): void => {
    // Real impl will branch on the recurring scope (this / following / all)
    // to update one occurrence vs the series. For the prototype we apply the
    // patch to the current record.
    updateHostedEvent(original.id, {
      title: title.trim() || original.title,
      startAt: nextStartAt,
      endAt: nextEndAt,
      locationLabel: locationLabel.trim() || original.locationLabel,
      locationDetail: locationDetail.trim() || undefined,
      recurrence,
    })
    if (timeChanged) fan("time", `${startDate} ${startTime}`)
    if (locationChanged) fan("location", locationLabel.trim())
    router.push("/event")
  }

  const handleSaveClick = (): void => {
    if (!dirty) {
      router.push("/event")
      return
    }
    if (willNotifyAttendees) {
      setDiffOpen(true)
      return
    }
    if (recurrence !== "none") {
      setScopeNeeded(true)
      return
    }
    persistChanges()
  }

  const handleConfirmDiff = (): void => {
    setDiffOpen(false)
    if (recurrence !== "none") {
      setScopeNeeded(true)
      return
    }
    persistChanges()
  }

  const handleScope = (scope: RecurringScope): void => {
    // The chosen scope ("this" / "following" / "all") rides along until the
    // backend can branch on it. Logged so it shows up during prototype runs.
    if (process.env.NODE_ENV !== "production") {
      console.info("[sponti] recurring edit scope:", scope)
    }
    setScopeNeeded(false)
    persistChanges()
  }

  const handleCancelEvent = (): void => {
    cancelHostedEvent(original.id)
    fan("cancelled")
    setConfirmCancel(false)
    router.push("/event")
  }

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button
            onClick={() => router.push("/event")}
            aria-label="Back"
            className="h-9 w-9 rounded-full border border-foreground flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-base font-semibold">
            <Pencil className="h-4 w-4" />
            <span>edit flare</span>
          </div>
          <div className="h-9 w-9" aria-hidden />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-44">
          {isPast && (
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground mb-4">
              past flares are read-only — duplicate to reuse the setup.
            </div>
          )}

          {isLive && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs mb-4">
              this flare is live. moving the start time after kickoff is disabled.
            </div>
          )}

          <Section label="title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              disabled={isPast}
            />
          </Section>

          {initialShape?.mode === "scheduled" && (
            <Section label="when">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="edit-date" className="text-xs text-muted-foreground">
                    date
                  </Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isPast || isLive}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="edit-time" className="text-xs text-muted-foreground">
                    start
                  </Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isPast || isLive}
                  />
                </div>
              </div>
            </Section>
          )}

          <Section label="how long">
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <Chip
                  key={d.minutes}
                  selected={durationMinutes === d.minutes}
                  onClick={() => setDurationMinutes(d.minutes)}
                  disabled={isPast}
                >
                  {d.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section label="where">
            <Input
              placeholder="search a place"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              disabled={isPast}
            />
            <Input
              placeholder="extra detail (optional)"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              maxLength={60}
              className="mt-2"
              disabled={isPast}
            />
            {!isPast && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {RECENT_PLACES.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setLocationLabel(p.label)
                      setLocationDetail(p.detail)
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-background text-[11px] hover:bg-secondary"
                  >
                    <MapPin className="h-3 w-3" />
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section label="repeat">
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map((r) => (
                <Chip
                  key={r.value}
                  selected={recurrence === r.value}
                  onClick={() => setRecurrence(r.value)}
                  disabled={isPast}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          </Section>

          {!isPast && (
            <Section label="danger zone">
              <Button
                variant="outline"
                onClick={() => setConfirmCancel(true)}
                className="w-full rounded-full text-destructive border-destructive/30 hover:bg-destructive/5"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                cancel this flare
              </Button>
            </Section>
          )}
        </div>

        {!isPast && (
          <div className="absolute bottom-24 left-0 right-0 px-4 z-20">
            <Button
              onClick={handleSaveClick}
              disabled={!dirty}
              className="w-full rounded-full py-6 text-base bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
            >
              {dirty ? "save changes" : "no changes yet"}
            </Button>
          </div>
        )}

        <div className="absolute bottom-6 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <BottomNav />
          </div>
        </div>

        {confirmCancel && (
          <CancelEventDialog
            event={event}
            status={status}
            onClose={() => setConfirmCancel(false)}
            onConfirm={handleCancelEvent}
          />
        )}

        {diffOpen && (
          <DiffSummary
            timeChanged={timeChanged}
            locationChanged={locationChanged}
            attendeeCount={event.attendeeIds.length}
            onClose={() => setDiffOpen(false)}
            onConfirm={handleConfirmDiff}
          />
        )}

        {scopeNeeded && (
          <RecurringScopeModal
            onClose={() => setScopeNeeded(false)}
            onPick={handleScope}
          />
        )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <Label className="text-[11px] tracking-wide uppercase text-muted-foreground mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  )
}

function Chip({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm transition-colors disabled:opacity-40 ${
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-background text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  )
}

function DiffSummary({
  timeChanged,
  locationChanged,
  attendeeCount,
  onClose,
  onConfirm,
}: {
  timeChanged: boolean
  locationChanged: boolean
  attendeeCount: number
  onClose: () => void
  onConfirm: () => void
}) {
  const changes: string[] = []
  if (timeChanged) changes.push("time")
  if (locationChanged) changes.push("location")
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center px-4 pb-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative w-full bg-card rounded-2xl border border-border shadow-xl flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-semibold">notify {attendeeCount} {attendeeCount === 1 ? "friend" : "friends"}?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            you&apos;re changing <span className="font-medium text-foreground">{changes.join(" and ")}</span> —
            attendees get a heads-up.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-full">
            keep editing
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            send updates
          </Button>
        </div>
      </div>
    </div>
  )
}

function FrameMissing({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold">flare not found</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        it may have been deleted or you don&apos;t host it.
      </p>
      <Button onClick={onBack} className="rounded-full bg-accent text-accent-foreground">
        back to your flares
      </Button>
    </div>
  )
}
