"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Drawer } from "vaul"
import {
  Check,
  ChevronRight,
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
  type EventType,
} from "@/lib/api/events"
import {
  createCircle as createCircleRequest,
  fetchMyCircles,
} from "@/lib/api/circles"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import { type Circle, type Connection } from "@/lib/circles"
import { ensureSystemCircles, setCircles, useCircles } from "@/lib/circles-store"
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

export default function NewEventPage() {
  const router = useRouter()
  const { user } = useAuth()
  const hostName = user?.displayName?.trim() || "you"
  const storedCircles = useCircles()
  const [apiCircles, setApiCircles] = useState<Circle[] | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [audienceLoading, setAudienceLoading] = useState(true)
  const [audienceError, setAudienceError] = useState<string | null>(null)
  const circles = ensureSystemCircles(apiCircles ?? storedCircles)

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(0.6)
  const handleClose = () => {
    setDrawerOpen(false)
    router.push("/")
  }

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

  // NOW mode — base clock time captured at mount so wheel labels stay consistent
  const mountMinutes = useMemo(() => minutesNow(), [])
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
      "custom",
    [circles],
  )
  const effectiveAudience =
    audience === "custom" || circles.some((c) => c.id === audience)
      ? audience
      : defaultAudience
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [customListName, setCustomListName] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
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
    if (effectiveAudience === "custom") return selectedFriendIds.length
    return circles.find((c) => c.id === effectiveAudience)?.memberIds.length ?? 0
  }, [circles, effectiveAudience, isOpen, selectedFriendIds.length])

  const duplicateCustomCircleName = useMemo(() => {
    const name = customListName.trim().toLowerCase()
    if (!name || effectiveAudience !== "custom") return false
    return circles.some((c) => c.name.trim().toLowerCase() === name)
  }, [circles, customListName, effectiveAudience])

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
    if (!isOpen && duplicateCustomCircleName) {
      setSubmitError("You already have a circle with that name.")
      return
    }
    if (
      !isOpen &&
      effectiveAudience === "custom" &&
      selectedFriendIds.length === 0
    ) {
      setSubmitError("Pick at least one friend or choose an existing circle.")
      return
    }

    setIsSubmitting(true)
    const createdAt = new Date().toISOString()
    let finalAudience: Audience = effectiveAudience
    let eventAudience:
      | { kind: "public" }
      | { kind: "circle"; circleId: string }
      | { kind: "members"; memberIds: string[] } = { kind: "public" }

    try {
      if (!isOpen && effectiveAudience === "custom") {
        const name = customListName.trim()
        if (name) {
          const createdCircle = await createCircleRequest({
            name,
            type: "close",
            memberIds: selectedFriendIds,
          })
          setApiCircles((prev) => [...(prev ?? circles), createdCircle])
          setCircles((prev) => [
            ...prev.filter((c) => c.id !== createdCircle.id),
            createdCircle,
          ])
          finalAudience = createdCircle.id
          eventAudience = { kind: "circle", circleId: createdCircle.id }
        } else {
          finalAudience = "custom"
          eventAudience = { kind: "members", memberIds: selectedFriendIds }
        }
      } else if (!isOpen) {
        finalAudience = effectiveAudience
        eventAudience = { kind: "circle", circleId: effectiveAudience }
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
        selectedFriendIds:
          finalAudience === "custom" ? selectedFriendIds : undefined,
        customListName:
          finalAudience === "custom" && customListName.trim()
            ? customListName.trim()
            : undefined,
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

      await createEvent(
        createEventRequestFromDraft(draft, eventAudience, timeRange),
      )
      router.push("/")
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-background" />

      <Drawer.Root
        open={drawerOpen}
        onClose={handleClose}
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

            {/* Scrollable form — CTA sticks to the bottom of the visible scroll area */}
            <div className="flex-1 overflow-y-auto">
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
                      selectedFriendIds={selectedFriendIds}
                      customListName={customListName}
                      onOpenPicker={() => {
                        setAudience("custom")
                        setPickerOpen(true)
                      }}
                      allowForward={allowForward}
                      onAllowForward={setAllowForward}
                      allowPlusOne={allowPlusOne}
                      onAllowPlusOne={setAllowPlusOne}
                    />
                    {duplicateCustomCircleName && (
                      <p className="mt-2 text-xs text-destructive" role="alert">
                        you already have a circle with that name
                      </p>
                    )}
                  </Section>
                </div>
              </Tabs>

              {/* Sticky CTA — sticks to the bottom of the scroll viewport */}
              <div className="sticky bottom-0 z-10 border-t border-border bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                <div
                  className={`mb-2 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
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
                    duplicateCustomCircleName ||
                    (!isOpen && (audienceLoading || Boolean(audienceError)))
                  }
                  className="w-full rounded-full bg-accent py-6 text-base text-accent-foreground hover:bg-accent/90"
                >
                  {isSubmitting ? "lighting…" : "light a flare"}
                </Button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Friend picker — rendered above the drawer */}
      {pickerOpen && (
        <FriendPicker
          connections={connections}
          circles={circles}
          selectedIds={selectedFriendIds}
          listName={customListName}
          onListNameChange={setCustomListName}
          onSelectionChange={setSelectedFriendIds}
          onCancel={() => {
            setPickerOpen(false)
            if (selectedFriendIds.length === 0 && !customListName.trim()) {
              setAudience(defaultAudience)
            }
          }}
          onConfirm={() => setPickerOpen(false)}
        />
      )}
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
  selectedFriendIds,
  customListName,
  onOpenPicker,
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
  selectedFriendIds: string[]
  customListName: string
  onOpenPicker: () => void
  allowForward: boolean
  onAllowForward: (v: boolean) => void
  allowPlusOne: boolean
  onAllowPlusOne: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border p-3 transition-colors ${
          isOpen ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">open event</span>
          <span className="text-xs text-muted-foreground">
            appears on the public map
          </span>
        </div>
        <Switch checked={isOpen} onCheckedChange={onOpen} />
      </div>

      <Stepper value={guestLimit} onChange={onGuestLimit} min={1} max={200} />

      {!isOpen && (
        <BroadcastRow
          circles={circles}
          audience={audience}
          selectedFriendIds={selectedFriendIds}
          customListName={customListName}
          onOpen={onOpenPicker}
        />
      )}

      {!isOpen && (
        <InviteToggles
          allowPlusOne={allowPlusOne}
          onPlusOne={onAllowPlusOne}
          allowForward={allowForward}
          onForward={onAllowForward}
        />
      )}
    </div>
  )
}

function BroadcastRow({
  circles,
  audience,
  selectedFriendIds,
  customListName,
  onOpen,
}: {
  circles: Circle[]
  audience: Audience
  selectedFriendIds: string[]
  customListName: string
  onOpen: () => void
}) {
  const selectedCircle = circles.find((c) => c.id === audience)
  const label =
    audience === "custom"
      ? customListName.trim() || "custom selection"
      : (selectedCircle?.name ?? "friends")
  const count =
    audience === "custom"
      ? selectedFriendIds.length
      : (selectedCircle?.memberIds.length ?? 0)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left hover:bg-secondary"
    >
      <CircleStackIcon
        type={selectedCircle?.type ?? "close"}
        className="h-5 w-5 shrink-0 text-muted-foreground"
      />
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      {count > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
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
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${
          allowPlusOne
            ? "border-accent bg-accent/10 text-accent"
            : "border-border text-muted-foreground hover:bg-secondary"
        }`}
      >
        <UserPlus className="h-3.5 w-3.5 shrink-0" />
        +1 allowed
      </button>
      <button
        type="button"
        onClick={() => onForward(!allowForward)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${
          allowForward
            ? "border-accent bg-accent/10 text-accent"
            : "border-border text-muted-foreground hover:bg-secondary"
        }`}
      >
        <Share2 className="h-3.5 w-3.5 shrink-0" />
        friends can re-share
      </button>
    </div>
  )
}

// ----- Guest limit stepper -----

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
      className={`flex items-center justify-between rounded-xl border border-border px-3 py-2.5 ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <span className="text-sm font-medium">guest limit</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          aria-label="decrease"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-secondary disabled:opacity-40"
          disabled={disabled || value <= min}
        >
          <Minus className="h-3.5 w-3.5" />
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
          className="w-12 bg-transparent text-center text-base font-medium outline-none"
        />
        <button
          type="button"
          onClick={inc}
          aria-label="increase"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-secondary disabled:opacity-40"
          disabled={disabled || value >= max}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ----- Friend picker -----

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((id) => setA.has(id))
}

function FriendPicker({
  connections,
  circles,
  selectedIds,
  listName,
  onListNameChange,
  onSelectionChange,
  onCancel,
  onConfirm,
}: {
  connections: Connection[]
  circles: Circle[]
  selectedIds: string[]
  listName: string
  onListNameChange: (v: string) => void
  onSelectionChange: (next: string[]) => void
  onCancel: () => void
  onConfirm: () => void
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

  const activeCircleId = useMemo(() => {
    return circles.find((c) => setsEqual(c.memberIds, selectedIds))?.id ?? null
  }, [circles, selectedIds])

  const toggleId = (id: string): void => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    )
  }

  const startFromCircle = (circle: Circle): void => {
    onSelectionChange(circle.memberIds)
  }

  const clearSelection = (): void => {
    onSelectionChange([])
  }

  const count = selectedIds.length
  const willSave = listName.trim().length > 0
  const ctaLabel =
    count === 0
      ? "select friends"
      : willSave
        ? `save list · ${count}`
        : `invite ${count} ${count === 1 ? "person" : "people"}`

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative mt-auto flex max-h-[88%] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs font-medium text-muted-foreground">
            broadcast to
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close picker"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 px-4 pb-2">
          <Label className="mb-1 block text-xs text-muted-foreground">
            start from a circle
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {circles.map((c) => {
              const active = c.id === activeCircleId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => startFromCircle(c)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {c.memberIds.length}
                  </span>
                </button>
              )
            })}
            {count > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                clear
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 pb-2">
          <Label
            htmlFor="list-name"
            className="mb-1 block text-xs text-muted-foreground"
          >
            save as new circle (optional)
          </Label>
          <Input
            id="list-name"
            placeholder="circle name (e.g. studio crew)"
            value={listName}
            onChange={(e) => onListNameChange(e.target.value)}
            maxLength={40}
            className="border-accent/40"
          />
        </div>

        <div className="shrink-0 px-4 pb-2">
          <Input
            placeholder="search friends…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              no matches
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((c) => {
                const checked = selectedIds.includes(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggleId(c.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-secondary"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          checked
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{c.displayName}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          @{c.username}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 rounded-full"
          >
            cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={count === 0}
            className="flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
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
