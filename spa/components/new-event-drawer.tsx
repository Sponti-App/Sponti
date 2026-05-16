"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Drawer } from "vaul"
import {
  Check,
  MapPin,
  Minus,
  Plus,
  Search,
  Share2,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { CircleStackIcon } from "@/components/circle-stack-icon"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  createEvent,
  createEventRequestFromDraft,
  type Audience,
  type DraftEvent,
  type EventAudienceTarget,
  type EventType,
} from "@/lib/api/events"
import { fetchMyCircles } from "@/lib/api/circles"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import { HttpError } from "@/lib/http"
import { type Circle, type Connection } from "@/lib/circles"
import {
  addMemberToCircle,
  ensureSystemCircles,
  removeMemberFromCircle,
  setCircles,
  useCircles,
} from "@/lib/circles-store"
import { EVENT_TYPES } from "@/types/utils"

type Mode = "now" | "scheduled"
type WhereType = "current" | "search"
type PlaceSuggestion = { label: string; address: string }

const STEP_MIN = 15
const NOW_MAX_OFFSET_MIN = 360
const MAX_DURATION_MIN = 240
const MIN_DURATION_MIN = 15
const SCHEDULED_MAX_DAYS = 14
const SCHEDULED_DAY_START_MIN = 6 * 60
const SCHEDULED_DAY_END_MIN = 26 * 60
const OPEN_ENDED = -1
const OPEN_ENDED_FALLBACK_MIN = 8 * 60

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function minutesNow(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function formatRelative(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

function formatTimeOfDay(minSinceMidnight: number): string {
  const total = ((minSinceMidnight % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  const m = total % 60
  const ampm = h >= 12 ? "pm" : "am"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0
    ? `${h12}${ampm}`
    : `${h12}:${String(m).padStart(2, "0")}${ampm}`
}

function formatDayChip(d: Date): { weekday: string; date: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (24 * 3600 * 1000),
  )
  if (diffDays === 0) return { weekday: "today", date: String(d.getDate()) }
  if (diffDays === 1) return { weekday: "tmrw", date: String(d.getDate()) }
  return {
    weekday: d
      .toLocaleDateString(undefined, { weekday: "short" })
      .toLowerCase(),
    date: String(d.getDate()),
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Something went wrong. Try again."
}

// Surfaces Zod validation details from the backend so the UI tells the user
// which field is wrong instead of a generic "Validation failed".
function formatSubmitError(error: unknown): string {
  if (error instanceof HttpError && Array.isArray(error.details)) {
    type ZodIssue = { path?: (string | number)[]; message?: string }
    const issues = error.details as ZodIssue[]
    const summary = issues
      .slice(0, 3)
      .map((i) => {
        const path = i.path?.join(".") || "field"
        return `${path}: ${i.message ?? "invalid"}`
      })
      .join(" · ")
    if (summary) return `${error.message} — ${summary}`
  }
  return getErrorMessage(error)
}

function buildTimeRange(args: {
  mode: Mode
  createdAt: string
  startOffsetMin: number
  startDate: string
  startTimeMin: number
  durationMin: number | null
}): { startAt: string; endAt: string } {
  let startMs: number
  if (args.mode === "now") {
    startMs = new Date(args.createdAt).getTime() + args.startOffsetMin * 60_000
  } else {
    const start = new Date(`${args.startDate}T00:00:00`)
    start.setMinutes(start.getMinutes() + args.startTimeMin)
    startMs = start.getTime()
  }
  const dur =
    args.durationMin !== null ? args.durationMin : OPEN_ENDED_FALLBACK_MIN
  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + dur * 60_000).toISOString(),
  }
}

export function NewEventDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const hostName = user?.displayName?.trim() || "you"
  const storedCircles = useCircles()
  const [apiCircles, setApiCircles] = useState<Circle[] | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [audienceLoading, setAudienceLoading] = useState(true)
  const [audienceError, setAudienceError] = useState<string | null>(null)
  const circles = ensureSystemCircles(apiCircles ?? storedCircles)

  // Drawer
  const [activeSnapPoint, setActiveSnapPoint] = useState<
    number | string | null
  >(0.6)
  const handleClose = onClose

  // Mode
  const [mode, setMode] = useState<Mode>("now")
  const handleModeChange = (v: string) => {
    const next = v as Mode
    setMode(next)
    setActiveSnapPoint(next === "scheduled" ? 0.95 : 0.6)
  }

  // Event type (null = skipped by user)
  const [eventType, setEventType] = useState<EventType | null>(null)

  // What
  const [title, setTitle] = useState("")
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [details, setDetails] = useState("")

  // Round to nearest STEP_MIN so every wheel label lands on a clean interval
  // (e.g. 4:26 → 4:30 instead of 4:26).
  const mountMinutes = useMemo(
    () => Math.round(minutesNow() / STEP_MIN) * STEP_MIN,
    [],
  )
  const [startOffsetMin, setStartOffsetMin] = useState(0)
  const [endOffsetMin, setEndOffsetMin] = useState(60)

  // SCHEDULED mode
  const [startDate, setStartDate] = useState(formatDateInput(new Date()))
  const [startTimeMin, setStartTimeMin] = useState(19 * 60)
  const [endTimeMin, setEndTimeMin] = useState(20 * 60)

  // WHERE
  const [whereType, setWhereType] = useState<WhereType>("current")
  const [searchQuery, setSearchQuery] = useState("")
  const [pickedSearchAddress, setPickedSearchAddress] = useState("")
  const [placeResults, setPlaceResults] = useState<PlaceSuggestion[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // GUESTS
  const [isOpen, setIsOpen] = useState(false)
  const [guestLimit, setGuestLimit] = useState(10)
  const [audience, setAudience] = useState<Audience>("")
  const defaultAudience = useMemo(
    () =>
      circles.find((c) => c.type === "close")?.id ??
      circles.find((c) => c.name.toLowerCase() === "close friends")?.id ??
      circles[0]?.id ??
      "",
    [circles],
  )
  const effectiveAudience = circles.some((c) => c.id === audience)
    ? audience
    : defaultAudience
  // Direct invites are extras on top of whatever circle is selected — they
  // become `members` on the create-event request alongside `circles`. Lets
  // the user pick inner + add a couple more people for this one event.
  const [directlyInvitedIds, setDirectlyInvitedIds] = useState<string[]>([])
  // Inner/Close are editable inline via long-press. This holds the id of the
  // circle currently being edited; null when no edit panel is open.
  const [editingCircleId, setEditingCircleId] = useState<string | null>(null)
  const [allowForward, setAllowForward] = useState(false)
  const [allowPlusOne, setAllowPlusOne] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetchAcceptedConnections(controller.signal),
      fetchMyCircles(controller.signal),
    ])
      .then(([nextConnections, nextCircles]) => {
        if (controller.signal.aborted) return
        setConnections(nextConnections)
        setApiCircles(nextCircles)
        setCircles(nextCircles)
        setAudienceLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setAudienceError(getErrorMessage(error))
        setAudienceLoading(false)
      })
    return () => controller.abort()
  }, [])

  // The drawer stays mounted in the provider, so transient view state (which
  // circle is being edited inline) would leak across open/close. Reset it
  // whenever the drawer is closed so reopening starts fresh.
  useEffect(() => {
    if (!open) setEditingCircleId(null)
  }, [open])

  const handleStartOffset = (next: number): void => {
    setStartOffsetMin(next)
    setEndOffsetMin((prev) => {
      if (prev === OPEN_ENDED) return OPEN_ENDED
      const min = next + MIN_DURATION_MIN
      const max = next + MAX_DURATION_MIN
      if (prev < min) return min
      if (prev > max) return max
      return prev
    })
  }

  const handleStartTime = (next: number): void => {
    setStartTimeMin(next)
    setEndTimeMin((prev) => {
      const min = next + MIN_DURATION_MIN
      const max = next + MAX_DURATION_MIN
      if (prev < min) return min
      if (prev > max) return max
      return prev
    })
  }

  // Google Places search via /api/places proxy
  const searchPlaces = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setPlaceResults([])
      setPlacesLoading(false)
      return
    }
    setPlacesLoading(true)
    try {
      const resp = await fetch(
        `/api/places?input=${encodeURIComponent(query.trim())}`,
      )
      if (!resp.ok) throw new Error("places error")
      const data = (await resp.json()) as { suggestions: PlaceSuggestion[] }
      setPlaceResults(data.suggestions)
    } catch {
      setPlaceResults([])
    } finally {
      setPlacesLoading(false)
    }
  }, [])

  const handleSearchQuery = (v: string): void => {
    setSearchQuery(v)
    setPickedSearchAddress("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void searchPlaces(v)
    }, 350)
  }

  // Now-mode wheel options use absolute clock-time labels so the user sees
  // "9:30pm" instead of "+30m", matching the scheduled-mode wheel behaviour.
  const nowStartOptions = useMemo(() => {
    const out: { value: number; label: string }[] = []
    for (let m = 0; m <= NOW_MAX_OFFSET_MIN; m += STEP_MIN) {
      const wallMin = ((mountMinutes + m) % 1440 + 1440) % 1440
      out.push({ value: m, label: m === 0 ? "now" : formatTimeOfDay(wallMin) })
    }
    return out
  }, [mountMinutes])

  const nowEndOptions = useMemo(() => {
    const out: { value: number; label: string }[] = []
    const min = startOffsetMin + MIN_DURATION_MIN
    const max = startOffsetMin + MAX_DURATION_MIN
    for (let m = min; m <= max; m += STEP_MIN) {
      const wallMin = ((mountMinutes + m) % 1440 + 1440) % 1440
      out.push({ value: m, label: formatTimeOfDay(wallMin) })
    }
    out.push({ value: OPEN_ENDED, label: "open" })
    return out
  }, [startOffsetMin, mountMinutes])

  const scheduledStartOptions = useMemo(() => {
    const out: { value: number; label: string }[] = []
    for (
      let m = SCHEDULED_DAY_START_MIN;
      m <= SCHEDULED_DAY_END_MIN;
      m += STEP_MIN
    ) {
      out.push({ value: m, label: formatTimeOfDay(m) })
    }
    return out
  }, [])

  const scheduledEndOptions = useMemo(() => {
    const out: { value: number; label: string }[] = []
    const min = startTimeMin + MIN_DURATION_MIN
    const max = startTimeMin + MAX_DURATION_MIN
    for (let m = min; m <= max; m += STEP_MIN) {
      out.push({ value: m, label: formatTimeOfDay(m) })
    }
    return out
  }, [startTimeMin])

  const durationMin = useMemo<number | null>(() => {
    if (mode === "now") {
      return endOffsetMin === OPEN_ENDED ? null : endOffsetMin - startOffsetMin
    }
    return endTimeMin - startTimeMin
  }, [mode, endOffsetMin, startOffsetMin, endTimeMin, startTimeMin])

  const wallTimeForNow = useMemo(() => {
    const startMin = ((mountMinutes + startOffsetMin) % 1440 + 1440) % 1440
    const endMin =
      endOffsetMin === OPEN_ENDED
        ? null
        : ((mountMinutes + endOffsetMin) % 1440 + 1440) % 1440
    return { startMin, endMin }
  }, [mountMinutes, startOffsetMin, endOffsetMin])

  const whereLabel = useMemo<string | null>(() => {
    if (whereType === "current") return "current loc"
    if (whereType === "search") {
      const v = pickedSearchAddress || searchQuery.trim()
      return v || null
    }
    return null
  }, [whereType, pickedSearchAddress, searchQuery])

  const whenLabel = useMemo(() => {
    if (mode === "now") {
      return startOffsetMin === 0 ? "now" : `in ${formatRelative(startOffsetMin)}`
    }
    const d = new Date(startDate + "T00:00:00")
    const chip = formatDayChip(d)
    return `${chip.weekday} ${formatTimeOfDay(startTimeMin)}`
  }, [mode, startOffsetMin, startDate, startTimeMin])

  const dateStripDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: SCHEDULED_MAX_DAYS }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [])

  const inviteeCount = useMemo(() => {
    if (isOpen) return 0
    const circleMembers =
      circles.find((c) => c.id === effectiveAudience)?.memberIds ?? []
    // Dedupe: if a directly-invited person is already in the selected circle,
    // they only get counted once (the backend dedupes too).
    const memberSet = new Set(circleMembers)
    const extras = directlyInvitedIds.filter((id) => !memberSet.has(id)).length
    return circleMembers.length + extras
  }, [circles, effectiveAudience, isOpen, directlyInvitedIds])

  const isOverLimit = !isOpen && inviteeCount > guestLimit

  const headcountLabel = isOpen
    ? `public · up to ${guestLimit}`
    : inviteeCount === 0
      ? `up to ${guestLimit} guests`
      : `${inviteeCount} ${inviteeCount === 1 ? "person" : "people"} will see this`

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) return
    setSubmitError(null)

    if (!isOpen && audienceLoading) {
      setSubmitError("Still loading your circles and friends.")
      return
    }
    if (!isOpen && audienceError) {
      setSubmitError(
        "Load your circles and friends before creating a private event.",
      )
      return
    }
    setIsSubmitting(true)
    const createdAt = new Date().toISOString()
    const finalAudience: Audience = effectiveAudience
    let eventAudience: EventAudienceTarget = { kind: "public" }

    try {
      if (!isOpen) {
        // Direct invites only ride along with "all friends" — they become
        // extra `members` on the API request on top of the circle invite.
        // Works with any circle — user can pick inner and add a few extras.
        eventAudience = {
          kind: "circle",
          circleId: effectiveAudience,
          extraMemberIds:
            directlyInvitedIds.length > 0 ? directlyInvitedIds : undefined,
        }
      }

      const effectiveType = eventType ?? "hangout"
      const effectiveDuration =
        durationMin !== null ? durationMin : OPEN_ENDED_FALLBACK_MIN
      const finalTitle =
        title.trim() ||
        [effectiveType, hostName, whereLabel, whenLabel]
          .filter(Boolean)
          .join(" · ")

      const scheduledStart = new Date(`${startDate}T00:00:00`)
      scheduledStart.setMinutes(scheduledStart.getMinutes() + startTimeMin)

      const draft: DraftEvent = {
        mode,
        eventType: effectiveType,
        title: finalTitle,
        details: details.trim() || undefined,
        durationMinutes: effectiveDuration,
        startOffsetMinutes: mode === "now" ? startOffsetMin : undefined,
        startDate:
          mode === "scheduled" ? formatDateInput(scheduledStart) : undefined,
        startTime:
          mode === "scheduled"
            ? `${String(scheduledStart.getHours()).padStart(2, "0")}:${String(scheduledStart.getMinutes()).padStart(2, "0")}`
            : undefined,
        whereType,
        customWhere:
          whereType === "search"
            ? pickedSearchAddress || searchQuery.trim() || undefined
            : undefined,
        guestLimit,
        audience: isOpen
          ? (circles.find((c) => c.type === "all")?.id ?? finalAudience)
          : finalAudience,
        visibility: isOpen ? "public" : "private",
        allowForward: isOpen ? false : allowForward,
        allowPlusOne: isOpen ? false : allowPlusOne,
        createdAt,
      }

      const timeRange = buildTimeRange({
        mode,
        createdAt,
        startOffsetMin,
        startDate,
        startTimeMin,
        durationMin,
      })

      const requestBody = createEventRequestFromDraft(
        draft,
        eventAudience,
        timeRange,
      )
      console.log("[Sponti] POST /events payload", requestBody)
      try {
        await createEvent(requestBody)
      } catch (err) {
        if (err instanceof HttpError) {
          console.error(
            "[Sponti] POST /events failed",
            err.status,
            err.code,
            err.details,
          )
        }
        throw err
      }
      onClose()
    } catch (error) {
      setSubmitError(formatSubmitError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        snapPoints={[0.6, 0.95]}
        activeSnapPoint={activeSnapPoint}
        setActiveSnapPoint={setActiveSnapPoint}
        dismissible
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/25" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[95svh] flex-col rounded-t-3xl border-t border-border bg-card">
            {/* Drag handle */}
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />
            {/* Vaul uses Radix Dialog internally — DialogTitle required for a11y */}
            <Drawer.Title className="sr-only">light a flare</Drawer.Title>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5 text-base font-semibold">
                <Sparkles className="h-4 w-4" />
                <span>light a flare</span>
              </div>
              <div className="h-9 w-9" aria-hidden />
            </div>

            {/* Scrollable form. The padding-bottom uses vaul's --snap-point-height
                (the drawer's translateY at the current snap) plus space for the
                CTA, so the last form field doesn't hide under the pinned CTA. */}
            <div
              className="flex-1 overflow-y-auto"
              style={{
                paddingBottom:
                  "calc(var(--snap-point-height, 0px) + 160px)",
              }}
              data-vaul-no-drag
            >
              <Tabs value={mode} onValueChange={handleModeChange}>
                <div className="px-4 pb-1">
                  <TabsList className="w-full">
                    <TabsTrigger value="now">right now</TabsTrigger>
                    <TabsTrigger value="scheduled">pick a time</TabsTrigger>
                  </TabsList>
                </div>

                <div className="px-4">
                  {/* 1. Event type */}
                  <Section label="what do you feel like?">
                    <EventTypePills value={eventType} onChange={setEventType} />
                  </Section>

                  {/* 2. What */}
                  <Section label="what's the plan?">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                      placeholder="let's get drinks after work"
                    />
                    {title.length > 60 && (
                      <p className="mt-1 text-right text-[11px] text-muted-foreground">
                        {80 - title.length} left
                      </p>
                    )}
                    {detailsExpanded ? (
                      <textarea
                        value={details}
                        onChange={(e) =>
                          setDetails(e.target.value.slice(0, 200))
                        }
                        placeholder="dress code, what to bring, vibe…"
                        rows={3}
                        autoFocus
                        className="mt-2 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDetailsExpanded(true)}
                        className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        + add a note
                      </button>
                    )}
                    {detailsExpanded && details.length > 160 && (
                      <p className="mt-1 text-right text-[11px] text-muted-foreground">
                        {200 - details.length} left
                      </p>
                    )}
                  </Section>

                  {/* 3. When */}
                  <TabsContent value="now" className="m-0">
                    <Section label="how long should it last?">
                      <TimeRange
                        startOptions={nowStartOptions}
                        endOptions={nowEndOptions}
                        startValue={startOffsetMin}
                        endValue={endOffsetMin}
                        onStart={handleStartOffset}
                        onEnd={setEndOffsetMin}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {startOffsetMin === 0
                          ? "starts now"
                          : `starts in ${formatRelative(startOffsetMin)}`}
                        {endOffsetMin === OPEN_ENDED
                          ? " · open-ended"
                          : durationMin !== null
                            ? ` · ${formatRelative(durationMin)}`
                            : ""}
                      </p>
                    </Section>
                  </TabsContent>

                  <TabsContent value="scheduled" className="m-0">
                    <Section label="date">
                      <DateStrip
                        days={dateStripDays}
                        value={startDate}
                        onChange={setStartDate}
                      />
                    </Section>
                    <Section label="how long should it last?">
                      <TimeRange
                        startOptions={scheduledStartOptions}
                        endOptions={scheduledEndOptions}
                        startValue={startTimeMin}
                        endValue={endTimeMin}
                        onStart={handleStartTime}
                        onEnd={setEndTimeMin}
                      />
                      {durationMin !== null && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          lasts {formatRelative(durationMin)}
                        </p>
                      )}
                    </Section>
                  </TabsContent>

                  {/* 4. Where */}
                  <Section label="where do you want to meet?">
                    <WherePicker
                      whereType={whereType}
                      onWhereType={setWhereType}
                      searchQuery={searchQuery}
                      onSearchQuery={handleSearchQuery}
                      pickedSearchAddress={pickedSearchAddress}
                      onPickSearch={(v) => {
                        setPickedSearchAddress(v)
                        setSearchQuery(v)
                        setPlaceResults([])
                      }}
                      placeResults={placeResults}
                      placesLoading={placesLoading}
                    />
                  </Section>

                  {/* 5. Who */}
                  <Section label="who's gonna see your flare?">
                    {audienceLoading && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        loading your circles and friends…
                      </p>
                    )}
                    {audienceError && (
                      <p
                        className="mb-2 text-xs text-destructive"
                        role="alert"
                      >
                        {audienceError}
                      </p>
                    )}
                    <WhoBlock
                      isOpen={isOpen}
                      onOpen={setIsOpen}
                      guestLimit={guestLimit}
                      onGuestLimit={setGuestLimit}
                      circles={circles}
                      audience={effectiveAudience}
                      onSelectAudience={setAudience}
                      connections={connections}
                      editingCircleId={editingCircleId}
                      onStartEditingCircle={setEditingCircleId}
                      onCloseEditingCircle={() => setEditingCircleId(null)}
                      directlyInvitedIds={directlyInvitedIds}
                      onToggleDirectInvite={(id) =>
                        setDirectlyInvitedIds((prev) =>
                          prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id],
                        )
                      }
                      allowForward={allowForward}
                      onAllowForward={setAllowForward}
                      allowPlusOne={allowPlusOne}
                      onAllowPlusOne={setAllowPlusOne}
                    />
                  </Section>
                </div>
              </Tabs>
            </div>

            {/* CTA pinned to the visible bottom of the drawer at any snap point.
                bottom = --snap-point-height cancels vaul's translateY so the
                button stays at the viewport bottom (matching the drawer's
                visible bottom edge), not the drawer's natural bottom. */}
            <div
              className="pointer-events-auto absolute inset-x-0 z-10 border-t border-border bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
              style={{
                bottom: "var(--snap-point-height, 0px)",
                transition: "bottom 0.5s cubic-bezier(.32,.72,0,1)",
              }}
            >
              <div
                className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  isOverLimit
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border text-foreground"
                }`}
              >
                <Users className="h-3 w-3 shrink-0" />
                <span>{headcountLabel}</span>
              </div>
              {submitError && (
                <p
                  className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  role="alert"
                >
                  {submitError}
                </p>
              )}
              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (!isOpen && (audienceLoading || Boolean(audienceError)))
                }
                className="w-full rounded-full bg-accent py-6 text-base text-accent-foreground hover:bg-accent/90"
              >
                {isSubmitting ? "lighting…" : "light a flare"}
              </Button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}

// ----- Event type pills -----

function EventTypePills({
  value,
  onChange,
}: {
  value: EventType | null
  onChange: (v: EventType | null) => void
}) {
  return (
    <div className="-mx-4 no-scrollbar overflow-x-auto px-4">
      <div className="flex gap-2 pb-0.5">
        {EVENT_TYPES.map((t) => {
          const selected = value === t.value
          const Icon = t.icon
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(selected ? null : t.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 transition-colors ${
                selected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {selected && (
                <span className="text-sm font-medium">{t.label}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ----- Time wheels -----

function TimeRange({
  startOptions,
  endOptions,
  startValue,
  endValue,
  onStart,
  onEnd,
}: {
  startOptions: { value: number; label: string }[]
  endOptions: { value: number; label: string }[]
  startValue: number
  endValue: number
  onStart: (v: number) => void
  onEnd: (v: number) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 text-center text-xs text-muted-foreground">
            start
          </div>
          <TimeWheel
            options={startOptions}
            value={startValue}
            onChange={onStart}
            ariaLabel="start time"
          />
        </div>
        <div>
          <div className="mb-1 text-center text-xs text-muted-foreground">
            end
          </div>
          <TimeWheel
            options={endOptions}
            value={endValue}
            onChange={onEnd}
            ariaLabel="end time"
          />
        </div>
      </div>
    </div>
  )
}

function TimeWheel({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: number; label: string }[]
  value: number
  onChange: (v: number) => void
  ariaLabel: string
}) {
  const ITEM_H = 36
  const VISIBLE = 3
  const PAD = Math.floor(VISIBLE / 2) * ITEM_H
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const idx = options.findIndex((o) => o.value === value)
    if (idx < 0 || !ref.current) return
    const target = idx * ITEM_H
    if (Math.abs(ref.current.scrollTop - target) > 1) {
      ref.current.scrollTop = target
    }
  }, [value, options])

  const handleScroll = (): void => {
    const el = ref.current
    if (!el) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(idx, options.length - 1))
      const next = options[clamped]
      if (next && next.value !== value) onChange(next.value)
    }, 90)
  }

  const handleItemClick = (idx: number): void => {
    if (!ref.current) return
    ref.current.scrollTo({ top: idx * ITEM_H, behavior: "smooth" })
  }

  const selectedIdx = options.findIndex((o) => o.value === value)

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-background"
      style={{ height: VISIBLE * ITEM_H }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 rounded-md border-y border-accent/40 bg-accent/10"
        aria-hidden
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        role="listbox"
        aria-label={ariaLabel}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll"
      >
        <div style={{ height: PAD }} aria-hidden />
        {options.map((o, i) => {
          const selected = i === selectedIdx
          return (
            <div
              key={`${o.value}-${i}`}
              role="option"
              aria-selected={selected}
              onClick={() => handleItemClick(i)}
              className={`flex h-9 cursor-pointer snap-center items-center justify-center text-sm transition-colors ${
                selected
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {o.label}
            </div>
          )
        })}
        <div style={{ height: PAD }} aria-hidden />
      </div>
    </div>
  )
}

// ----- Date strip -----

function DateStrip({
  days,
  value,
  onChange,
}: {
  days: Date[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="-mx-1 no-scrollbar overflow-x-auto">
      <div className="flex gap-1.5 px-1">
        {days.map((d) => {
          const iso = formatDateInput(d)
          const selected = iso === value
          const chip = formatDayChip(d)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              className={`flex w-14 shrink-0 flex-col items-center rounded-xl border px-2 py-2 transition-colors ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              <span
                className={`text-[11px] ${selected ? "text-accent" : "text-muted-foreground"}`}
              >
                {chip.weekday}
              </span>
              <span
                className={`text-base font-medium ${selected ? "text-accent" : "text-foreground"}`}
              >
                {chip.date}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ----- Where picker -----

function WherePicker({
  whereType,
  onWhereType,
  searchQuery,
  onSearchQuery,
  pickedSearchAddress,
  onPickSearch,
  placeResults,
  placesLoading,
}: {
  whereType: WhereType
  onWhereType: (v: WhereType) => void
  searchQuery: string
  onSearchQuery: (v: string) => void
  pickedSearchAddress: string
  onPickSearch: (v: string) => void
  placeResults: PlaceSuggestion[]
  placesLoading: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <ChipRow>
        <Chip
          selected={whereType === "current"}
          onClick={() => onWhereType("current")}
        >
          <MapPin className="h-3.5 w-3.5" />
          current loc
        </Chip>
        <Chip
          selected={whereType === "search"}
          onClick={() => onWhereType("search")}
        >
          <Search className="h-3.5 w-3.5" />
          search
        </Chip>
      </ChipRow>

      {whereType === "search" && (
        <div className="mt-1">
          <Input
            placeholder="search for a place"
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
          />
          {placesLoading && (
            <p className="mt-1.5 text-xs text-muted-foreground">searching…</p>
          )}
          {!placesLoading && !pickedSearchAddress && placeResults.length > 0 && (
            <ul className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card">
              {placeResults.map((r) => (
                <li key={`${r.label}-${r.address}`}>
                  <button
                    type="button"
                    onClick={() => onPickSearch(r.label)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-secondary"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{r.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.address}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ----- Who block -----

function WhoBlock({
  isOpen,
  onOpen,
  guestLimit,
  onGuestLimit,
  circles,
  audience,
  onSelectAudience,
  connections,
  editingCircleId,
  onStartEditingCircle,
  onCloseEditingCircle,
  directlyInvitedIds,
  onToggleDirectInvite,
  allowForward,
  onAllowForward,
  allowPlusOne,
  onAllowPlusOne,
}: {
  isOpen: boolean
  onOpen: (v: boolean) => void
  guestLimit: number
  onGuestLimit: (v: number) => void
  circles: Circle[]
  audience: Audience
  onSelectAudience: (circleId: string) => void
  connections: Connection[]
  editingCircleId: string | null
  onStartEditingCircle: (id: string) => void
  onCloseEditingCircle: () => void
  directlyInvitedIds: string[]
  onToggleDirectInvite: (id: string) => void
  allowForward: boolean
  onAllowForward: (v: boolean) => void
  allowPlusOne: boolean
  onAllowPlusOne: (v: boolean) => void
}) {
  const editingCircle = editingCircleId
    ? (circles.find((c) => c.id === editingCircleId) ?? null)
    : null

  return (
    <div className="flex flex-col gap-3">
      {/* Combined row: open-event toggle on the left, guest-limit stepper on
          the right. Splits one card into two columns so privacy + capacity
          live on a single line. */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
          isOpen ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <Switch checked={isOpen} onCheckedChange={onOpen} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          public
        </span>
        <div className="h-7 w-px shrink-0 bg-border" />
        <span className="shrink-0 text-xs text-muted-foreground">limit</span>
        <Stepper value={guestLimit} onChange={onGuestLimit} min={1} max={200} />
      </div>

      {!isOpen && editingCircle && (
        <CircleEditor
          circle={editingCircle}
          connections={connections}
          onClose={onCloseEditingCircle}
        />
      )}

      {!isOpen && !editingCircle && (
        <>
          <CircleCards
            circles={circles}
            audience={audience}
            onSelect={onSelectAudience}
            onEdit={onStartEditingCircle}
          />
          {/* Always-visible — selecting friends here adds them as direct
              invites on top of whatever circle is the audience. Not gated on
              "all friends" anymore: user can pick inner + add a few extras
              for this one event without permanently editing inner. */}
          <DirectInviteSearch
            connections={connections}
            directlyInvitedIds={directlyInvitedIds}
            onToggle={onToggleDirectInvite}
          />
          <InviteToggles
            allowPlusOne={allowPlusOne}
            onPlusOne={onAllowPlusOne}
            allowForward={allowForward}
            onForward={onAllowForward}
          />
        </>
      )}
    </div>
  )
}

// Long-press timer hook. Distinguishes a tap from a hold so a single card can
// serve both gestures: tap = select audience, hold = open the membership
// editor for that circle.
function useLongPress({
  onTap,
  onLongPress,
  ms = 450,
}: {
  onTap: () => void
  onLongPress: () => void
  ms?: number
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  // Track the captured element + pointerId so we can explicitly release the
  // browser's implicit pointer capture before firing onLongPress. Without
  // this, the chip unmounts mid-press (state change → CircleEditor renders)
  // while still holding capture, freezing pointer events on the new UI.
  const targetRef = useRef<HTMLElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const cancel = (): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const releaseCapture = (): void => {
    const target = targetRef.current
    const pid = pointerIdRef.current
    if (
      target &&
      pid !== null &&
      typeof target.hasPointerCapture === "function" &&
      target.hasPointerCapture(pid)
    ) {
      try {
        target.releasePointerCapture(pid)
      } catch {
        // pointer may have already been released by the browser
      }
    }
    targetRef.current = null
    pointerIdRef.current = null
  }

  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>): void => {
      longPressFired.current = false
      targetRef.current = e.currentTarget
      pointerIdRef.current = e.pointerId
      cancel()
      timerRef.current = setTimeout(() => {
        longPressFired.current = true
        releaseCapture()
        onLongPress()
      }, ms)
    },
    onPointerUp: (): void => {
      cancel()
      if (!longPressFired.current) onTap()
      releaseCapture()
    },
    onPointerLeave: (): void => {
      cancel()
      releaseCapture()
    },
    onPointerCancel: (): void => {
      cancel()
      releaseCapture()
    },
    // Right-click on desktop opens the editor too — long-press has no desktop
    // analog, and a context menu on a chip would be confusing.
    onContextMenu: (e: React.MouseEvent): void => {
      e.preventDefault()
      cancel()
      longPressFired.current = true
      releaseCapture()
      onLongPress()
    },
  }
}

// Three compact chips for the system circles. Inner/Close are editable — tap
// selects the audience, hold (or right-click) opens the inline editor. The
// pencil hint in the corner is the visible affordance for the gesture.
function CircleCards({
  circles,
  audience,
  onSelect,
  onEdit,
}: {
  circles: Circle[]
  audience: Audience
  onSelect: (circleId: string) => void
  onEdit: (circleId: string) => void
}) {
  const systemCircles = circles.filter(
    (c) => c.type === "inner" || c.type === "close" || c.type === "all",
  )
  return (
    <div className="grid grid-cols-3 gap-2">
      {systemCircles.map((c) => (
        <CircleChip
          key={c.id}
          circle={c}
          selected={c.id === audience}
          onSelect={() => onSelect(c.id)}
          onEdit={c.type === "all" ? undefined : () => onEdit(c.id)}
        />
      ))}
    </div>
  )
}

function CircleChip({
  circle,
  selected,
  onSelect,
  onEdit,
}: {
  circle: Circle
  selected: boolean
  onSelect: () => void
  onEdit?: () => void
}) {
  const editable = !!onEdit
  const handlers = useLongPress({
    onTap: onSelect,
    onLongPress: onEdit ?? onSelect,
  })
  // Only attach long-press handlers on editable circles. "all friends" is a
  // plain tap target — no editing path.
  const buttonHandlers = editable
    ? handlers
    : { onClick: onSelect, onContextMenu: undefined }

  // Editable chips (inner/close) get hover + press scale — the visual hint
  // that there's more interaction available. Holding past the long-press
  // threshold then fires onEdit. "All friends" stays flat (no edit path).
  const scaleClasses = editable
    ? "hover:scale-[1.03] active:scale-[1.06]"
    : ""

  return (
    <button
      type="button"
      {...buttonHandlers}
      className={`relative flex touch-none select-none items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 py-2 transition-transform duration-150 ${scaleClasses} ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border hover:bg-secondary"
      }`}
    >
      <CircleStackIcon
        type={circle.type}
        className={`h-3.5 w-3.5 shrink-0 ${
          selected ? "text-accent" : "text-muted-foreground"
        }`}
      />
      <span
        className={`min-w-0 flex-1 truncate text-left text-xs ${
          selected ? "font-medium text-accent" : "text-foreground"
        }`}
      >
        {circle.name}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground/70">
        {circle.memberIds.length}
      </span>
    </button>
  )
}

// Full-width replacement for the chip row when a circle is being edited.
// Tapping a friend adds/removes them from the circle (locally — TODO wire
// backend POST/DELETE /circles/:id/members once the ObjectId issue is fixed).
function CircleEditor({
  circle,
  connections,
  onClose,
}: {
  circle: Circle
  connections: Connection[]
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent bg-accent/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-accent">
          editing {circle.name}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Done editing"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent/10"
        >
          <X className="h-3.5 w-3.5 text-accent" />
        </button>
      </div>
      <FriendList
        connections={connections}
        selectedIds={circle.memberIds}
        // TODO(wiring): also call POST /circles/:id/members and
        // DELETE /circles/:id/members/:userId once the backend ObjectId
        // issue is fixed. Local store edit is optimistic-only for now.
        onToggle={(id) => {
          if (circle.memberIds.includes(id)) {
            removeMemberFromCircle(circle.id, id)
          } else {
            addMemberToCircle(circle.id, id)
          }
        }}
        emptyHint="no matches"
        searchPlaceholder="search friends…"
      />
    </div>
  )
}

// Shown only when audience is "all friends" — lets the user amplify the
// broadcast by directly inviting specific people on top of it (Instagram
// "tag in story" pattern).
function DirectInviteSearch({
  connections,
  directlyInvitedIds,
  onToggle,
}: {
  connections: Connection[]
  directlyInvitedIds: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <span className="text-xs text-muted-foreground">
        also invite specifically
        {directlyInvitedIds.length > 0 && (
          <span className="ml-1 text-accent">
            · {directlyInvitedIds.length} selected
          </span>
        )}
      </span>
      <FriendList
        connections={connections}
        selectedIds={directlyInvitedIds}
        onToggle={onToggle}
        emptyHint="no matches"
        searchPlaceholder="search friends…"
      />
    </div>
  )
}

// Shared primitive: search field + scrollable, checkboxed friend list.
// Used by CircleEditor (membership edit) and DirectInviteSearch (per-event
// invite). Stateless from the parent's perspective — selectedIds in,
// onToggle out.
function FriendList({
  connections,
  selectedIds,
  onToggle,
  emptyHint,
  searchPlaceholder,
}: {
  connections: Connection[]
  selectedIds: string[]
  onToggle: (id: string) => void
  emptyHint: string
  searchPlaceholder: string
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return connections
    return connections.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q),
    )
  }, [connections, query])

  return (
    <>
      <Input
        placeholder={searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="-mx-1 max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-xs text-muted-foreground">
            {emptyHint}
          </li>
        ) : (
          filtered.map((c) => {
            const checked = selectedIds.includes(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-secondary"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      checked
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border"
                    }`}
                  >
                    {checked && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {c.displayName}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      @{c.username}
                    </span>
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </>
  )
}

function InviteToggles({
  allowPlusOne,
  onPlusOne,
  allowForward,
  onForward,
}: {
  allowPlusOne: boolean
  onPlusOne: (v: boolean) => void
  allowForward: boolean
  onForward: (v: boolean) => void
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onPlusOne(!allowPlusOne)}
        className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
          allowPlusOne
            ? "border-accent bg-accent/10 text-accent"
            : "border-border text-muted-foreground hover:bg-secondary"
        }`}
      >
        <UserPlus className="h-3 w-3 shrink-0" />
        +1 allowed
      </button>
      <button
        type="button"
        onClick={() => onForward(!allowForward)}
        className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
          allowForward
            ? "border-accent bg-accent/10 text-accent"
            : "border-border text-muted-foreground hover:bg-secondary"
        }`}
      >
        <Share2 className="h-3 w-3 shrink-0" />
        can re-share
      </button>
    </div>
  )
}

// ----- Guest limit stepper -----

// Composable stepper — no card/border of its own, just the controls. Lets
// the caller place it inline next to other items (eg. the open-event toggle).
function Stepper({
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  min: number
  max: number
}) {
  const dec = (): void => onChange(Math.max(min, value - 1))
  const inc = (): void => onChange(Math.min(max, value + 1))
  return (
    <div
      className={`flex items-center gap-1.5 ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <button
        type="button"
        onClick={dec}
        aria-label="decrease"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border hover:bg-secondary disabled:opacity-40"
        disabled={disabled || value <= min}
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={disabled ? "—" : String(value)}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "")
          if (raw === "") return onChange(min)
          const n = Math.max(min, Math.min(max, parseInt(raw, 10)))
          onChange(n)
        }}
        className="w-8 bg-transparent text-center text-sm font-medium outline-none"
      />
      <button
        type="button"
        onClick={inc}
        aria-label="increase"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border hover:bg-secondary disabled:opacity-40"
        disabled={disabled || value >= max}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}


// ----- Shared primitives -----

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-5">
      <Label className="mb-2 block text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-background text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  )
}
