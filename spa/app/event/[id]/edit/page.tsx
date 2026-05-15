"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CancelEventDialog } from "@/components/cancel-event-dialog"
import {
  cancelEvent,
  deriveStatus,
  fetchHostedEventById,
  inferEventStartShape,
  reactivateEvent,
  updateEvent,
  type HostedEvent,
} from "@/lib/api/events"

const DURATION_OPTIONS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
] as const

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
  const [event, setEvent] = useState<HostedEvent | null>(null)
  const [original, setOriginal] = useState<HostedEvent | null>(null)
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [locationLabel, setLocationLabel] = useState("")
  const [locationDetail, setLocationDetail] = useState("")
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()

    queueMicrotask(() => {
      if (ac.signal.aborted) return
      setLoading(true)
      setError(null)
    })
    fetchHostedEventById(params.id, ac.signal)
      .then((nextEvent) => {
        const shape = inferEventStartShape(nextEvent)
        setEvent(nextEvent)
        setOriginal(nextEvent)
        setTitle(nextEvent.title)
        setStartDate(shape.startDate ?? "")
        setStartTime(shape.startTime ?? "")
        setDurationMinutes(shape.durationMinutes)
        setLocationLabel(nextEvent.locationLabel)
        setLocationDetail(nextEvent.locationDetail ?? "")
        setLoading(false)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        setError(err instanceof Error ? err.message : "Could not load flare")
        setLoading(false)
      })

    return () => ac.abort()
  }, [params.id])

  if (loading) {
    return (
      <FrameMessage
        title="loading flare..."
        onBack={() => router.push("/event")}
      />
    )
  }

  if (!event || !original) {
    return (
      <FrameMissing
        message={error ?? "it may have been deleted or you don't host it."}
        onBack={() => router.push("/event")}
      />
    )
  }

  const initialShape = inferEventStartShape(original)
  const status = deriveStatus(event)
  const isLive = status === "live"
  const isCancelled = status === "cancelled"
  const isPast =
    status === "past" ||
    deriveStatus({ ...event, apiStatus: "active" }) === "past"

  const nextStartAt =
    initialShape.mode === "scheduled" && startDate && startTime
      ? new Date(`${startDate}T${startTime}`).toISOString()
      : original.startAt
  const nextEndAt = new Date(
    new Date(nextStartAt).getTime() + durationMinutes * MIN
  ).toISOString()

  const titleChanged = title.trim() !== original.title
  const timeChanged =
    nextStartAt !== original.startAt ||
    durationMinutes !==
      Math.round(
        (new Date(original.endAt).getTime() -
          new Date(original.startAt).getTime()) /
          MIN
      )
  const locationChanged =
    locationLabel.trim() !== original.locationLabel ||
    (locationDetail.trim() || undefined) !== original.locationDetail

  const dirty = titleChanged || timeChanged || locationChanged

  const persistChanges = async (): Promise<void> => {
    try {
      setSaving(true)
      setError(null)
      await updateEvent(original.id, {
        title: title.trim() || original.title,
        startAt: nextStartAt,
        endAt: nextEndAt,
        locationName: locationLabel.trim() || original.locationLabel,
        locationAddress: locationDetail.trim() || null,
      })
      router.push("/event")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes")
      setSaving(false)
    }
  }

  const handleSaveClick = (): void => {
    if (!dirty) {
      router.push("/event")
      return
    }
    void persistChanges()
  }

  const handleCancelEvent = async (): Promise<void> => {
    try {
      setSaving(true)
      setError(null)
      await cancelEvent(original.id)
      router.push("/event")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel flare")
      setSaving(false)
    }
  }

  const handleReactivateEvent = async (): Promise<void> => {
    try {
      setSaving(true)
      setError(null)
      await reactivateEvent(original.id)
      router.push("/event")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reactivate flare"
      )
      setSaving(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push("/event")}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground"
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
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {isPast && (
          <div className="mb-4 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            past flares are read-only.
          </div>
        )}

        {isLive && (
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs">
            this flare is live. moving the start time after kickoff is disabled.
          </div>
        )}

        {isCancelled && !isPast && (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            this flare is cancelled. reactivate it before making new changes.
          </div>
        )}

        <Section label="title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            disabled={isPast || isCancelled || saving}
          />
        </Section>

        {initialShape.mode === "scheduled" && (
          <Section label="when">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="edit-date"
                  className="text-xs text-muted-foreground"
                >
                  date
                </Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isPast || isLive || isCancelled || saving}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="edit-time"
                  className="text-xs text-muted-foreground"
                >
                  start
                </Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isPast || isLive || isCancelled || saving}
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
                disabled={isPast || isCancelled || saving}
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
            disabled={isPast || isCancelled || saving}
          />
          <Input
            placeholder="extra detail (optional)"
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            maxLength={60}
            className="mt-2"
            disabled={isPast || isCancelled || saving}
          />
          {!isPast && !isCancelled && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RECENT_PLACES.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setLocationLabel(p.label)
                    setLocationDetail(p.detail)
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] hover:bg-secondary"
                  disabled={saving}
                >
                  <MapPin className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Recurrence is intentionally omitted until the V2 backend model exists. */}

        {!isPast && (
          <Section label="danger zone">
            {isCancelled ? (
              <Button
                variant="outline"
                onClick={() => void handleReactivateEvent()}
                disabled={saving}
                className="w-full rounded-full border-accent/30 text-accent hover:bg-accent/5"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                reactivate this flare
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmCancel(true)}
                disabled={saving}
                className="w-full rounded-full border-destructive/30 text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                cancel this flare
              </Button>
            )}
          </Section>
        )}
      </div>

      {!isPast && !isCancelled && (
        <div className="absolute right-0 bottom-24 left-0 z-20 px-4">
          <Button
            onClick={handleSaveClick}
            disabled={!dirty || saving}
            className="w-full rounded-full bg-accent py-6 text-base text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            {saving ? "saving..." : dirty ? "save changes" : "no changes yet"}
          </Button>
        </div>
      )}

      <div className="pointer-events-none absolute right-0 bottom-6 left-0 z-10">
        <div className="pointer-events-auto">
          <BottomNav />
        </div>
      </div>

      {confirmCancel && (
        <CancelEventDialog
          event={event}
          status={status}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => void handleCancelEvent()}
        />
      )}
    </div>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-5">
      <Label className="mb-2 block text-[11px] tracking-wide text-muted-foreground uppercase">
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors disabled:opacity-40 ${
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-background text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  )
}

function FrameMessage({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <Button
        onClick={onBack}
        className="mt-4 rounded-full bg-accent text-accent-foreground"
      >
        back to your flares
      </Button>
    </div>
  )
}

function FrameMissing({
  message,
  onBack,
}: {
  message: string
  onBack: () => void
}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm font-semibold">flare not found</p>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">{message}</p>
      <Button
        onClick={onBack}
        className="rounded-full bg-accent text-accent-foreground"
      >
        back to your flares
      </Button>
    </div>
  )
}
