"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Drawer } from "vaul"
import { haptic } from "@/lib/haptics"
import {
  Check,
  MapPin,
  Minus,
  Plus,
  Search,
  Share2,
  Sparkles,
  UserPlus,
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
  type DraftEventLocation,
  type EventAudienceTarget,
  type EventType,
} from "@/lib/api/events"
import { fetchMyCircles } from "@/lib/api/circles"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import { HttpError } from "@/lib/http"
import { useGeolocation, type GeoStatus } from "@/lib/geolocation"
import { emitEventsChanged } from "@/lib/use-events"
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
type PlaceSuggestion = { placeId: string; label: string; address: string }
type PlaceDetailsResponse = {
  placeId: string
  name: string
  address: string | null
  lat: number
  lng: number
}

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
    (target.getTime() - today.getTime()) / (24 * 3600 * 1000)
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

function isPlaceSuggestion(value: unknown): value is PlaceSuggestion {
  if (!value || typeof value !== "object") return false
  const suggestion = value as Record<string, unknown>
  return (
    typeof suggestion.placeId === "string" &&
    suggestion.placeId.trim().length > 0 &&
    typeof suggestion.label === "string" &&
    suggestion.label.trim().length > 0 &&
    typeof suggestion.address === "string"
  )
}

function isPlaceDetailsResponse(value: unknown): value is PlaceDetailsResponse {
  if (!value || typeof value !== "object") return false
  const place = value as Record<string, unknown>
  return (
    typeof place.placeId === "string" &&
    place.placeId.trim().length > 0 &&
    typeof place.name === "string" &&
    place.name.trim().length > 0 &&
    (typeof place.address === "string" || place.address === null) &&
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng)
  )
}

function currentLocationError(status: GeoStatus): string {
  if (status === "requesting") return "Still finding your location."
  return "Enable location access or search for a place."
}

// Cheap keyword inference so the user doesn't have to pick a type explicitly
// for the common cases. Ordered most-specific first — "coffee" wins as food
// before "hang" wins as hangout, etc. If nothing matches we don't return a
// guess (UI just defaults to "hangout" at submit time).
const TYPE_KEYWORDS: { type: EventType; pattern: RegExp }[] = [
  {
    type: "drinks",
    pattern:
      /\b(drinks?|beers?|wine|cocktails?|bar|pub|pints?|whiskey|gin|tequila|mezcal|aperol|spritz|happy hour)\b/i,
  },
  {
    type: "food",
    pattern:
      /\b(dinner|lunch|brunch|breakfast|food|eat|restaurant|pizza|burgers?|sushi|ramen|tacos?|coffee|cafe|café|bakery|bites)\b/i,
  },
  {
    type: "party",
    pattern: /\b(party|rager|club|clubbing|dance|nightlife|rave|warehouse)\b/i,
  },
  {
    type: "sports",
    pattern:
      /\b(hike|hiking|run|running|soccer|football|tennis|gym|yoga|workout|climb|climbing|swim|swimming|ride|bike|cycling|skate)\b/i,
  },
  {
    type: "culture",
    pattern:
      /\b(museum|exhibit|exhibition|movie|cinema|film|concert|show|theater|theatre|art|gallery|opera|gig|reading)\b/i,
  },
  {
    type: "hobby",
    pattern:
      /\b(knit|knitting|book club|chess|board game|boardgames?|craft|crafts|paint|painting|pottery|sketching|drawing)\b/i,
  },
  {
    type: "hangout",
    pattern: /\b(hang|hangout|chill|catch up|stroll|walk|picnic|park)\b/i,
  },
]

function inferEventType(title: string): EventType | null {
  if (!title.trim()) return null
  for (const { type, pattern } of TYPE_KEYWORDS) {
    if (pattern.test(title)) return type
  }
  return null
}

// Computes the event type that will actually be submitted: the user's manual
// pick wins, then the title-inferred type, then "hangout" as final fallback.
function resolveEventType(
  manual: EventType | null,
  inferred: EventType | null
): EventType {
  return manual ?? inferred ?? "hangout"
}

// Surfaces Zod validation details from the backend so the UI tells the user
// which field is wrong instead of a generic "Validation failed".
function formatSubmitError(error: unknown): string {
  if (error instanceof HttpError) {
    type ZodIssue = { path?: (string | number)[]; message?: string }

    const rawIssues = Array.isArray(error.details)
      ? error.details
      : error.details && typeof error.details === "object"
        ? (error.details as { body?: unknown }).body
        : null

    if (Array.isArray(rawIssues)) {
      const issues = rawIssues as ZodIssue[]
      const summary = issues
        .slice(0, 3)
        .map((i) => {
          const path = i.path?.join(".") || "field"
          return `${path}: ${i.message ?? "invalid"}`
        })
        .join(" · ")
      if (summary) return `${error.message} — ${summary}`
    }
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

type EventDraftStateDefaults = {
  activeSnapPoint: number | string | null
  mode: Mode
  eventType: EventType | null
  typeOverrideOpen: boolean
  title: string
  detailsExpanded: boolean
  details: string
  startOffsetMin: number
  endOffsetMin: number
  startDate: string
  startTimeMin: number
  endTimeMin: number
  whereType: WhereType
  searchQuery: string
  pickedSearchAddress: string
  selectedLocation: DraftEventLocation | null
  placeResults: PlaceSuggestion[]
  placesLoading: boolean
  placeDetailsLoading: boolean
  placeDetailsError: string | null
  isOpen: boolean
  guestLimit: number
  audience: Audience
  directlyInvitedIds: string[]
  editingCircleId: string | null
  allowForward: boolean
  allowPlusOne: boolean
  submitError: string | null
}

function getInitialEventDraftState(): EventDraftStateDefaults {
  // Keep wall-clock defaults in a factory so reset uses "today" at reset time.
  return {
    activeSnapPoint: 0.55,
    mode: "now",
    eventType: null,
    typeOverrideOpen: false,
    title: "",
    detailsExpanded: false,
    details: "",
    startOffsetMin: 0,
    endOffsetMin: 60,
    startDate: formatDateInput(new Date()),
    startTimeMin: 19 * 60,
    endTimeMin: 20 * 60,
    whereType: "current",
    searchQuery: "",
    pickedSearchAddress: "",
    selectedLocation: null,
    placeResults: [],
    placesLoading: false,
    placeDetailsLoading: false,
    placeDetailsError: null,
    isOpen: false,
    guestLimit: 10,
    audience: "",
    directlyInvitedIds: [],
    editingCircleId: null,
    allowForward: false,
    allowPlusOne: false,
    submitError: null,
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
  const {
    coords: geoCoords,
    status: geoStatus,
    errorMessage: geoErrorMessage,
    request: requestGeoLocation,
  } = useGeolocation({ autoRequest: false })
  const storedCircles = useCircles()
  const [apiCircles, setApiCircles] = useState<Circle[] | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [audienceLoading, setAudienceLoading] = useState(true)
  const [audienceError, setAudienceError] = useState<string | null>(null)
  const circles = ensureSystemCircles(apiCircles ?? storedCircles)

  // Drawer
  // Three snaps so the spontaneous flow can sit at a 0.55 "peek" (title +
  // summary chips + CTA above the fold), 0.8 for normal customization, and
  // 0.95 for full edit. 0.55 is the floor that fits chrome + title input +
  // summary chips + CTA stack on small viewports without clipping. Scheduled
  // mode jumps straight to 0.95 — there's no useful peek state when a
  // date/time picker is the whole point.
  const initialEventDraftState = useMemo(() => getInitialEventDraftState(), [])
  const [activeSnapPoint, setActiveSnapPoint] = useState<
    number | string | null
  >(initialEventDraftState.activeSnapPoint)
  const handleClose = onClose

  // Section refs let the summary-chip row scroll the form to the relevant
  // section when the user taps a chip. Also gates the expand-then-scroll
  // sequence on the next frame so the drawer has time to settle at 0.95.
  const scrollRef = useRef<HTMLDivElement>(null)
  const whenRef = useRef<HTMLDivElement>(null)
  const whereRef = useRef<HTMLDivElement>(null)
  const whoRef = useRef<HTMLDivElement>(null)

  const focusSection = (
    target: React.RefObject<HTMLDivElement | null>
  ): void => {
    setActiveSnapPoint(0.95)
    // Wait for the snap animation to start so the section actually exists
    // in the visible viewport before we scroll. Two frames covers the
    // initial layout flush + snap transition kick-off.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    })
  }

  // Mode
  const [mode, setMode] = useState<Mode>(initialEventDraftState.mode)
  const handleModeChange = (v: string) => {
    const next = v as Mode
    setMode(next)
    setActiveSnapPoint(next === "scheduled" ? 0.95 : 0.55)
  }

  // Event type — `eventType` holds the user's MANUAL pick (null = not picked
  // yet). The inferred type is derived from the title via keyword match.
  // `resolveEventType(manual, inferred)` decides what actually ships at submit.
  const [eventType, setEventType] = useState<EventType | null>(
    initialEventDraftState.eventType
  )
  const [typeOverrideOpen, setTypeOverrideOpen] = useState(
    initialEventDraftState.typeOverrideOpen
  )

  // What
  const [title, setTitle] = useState(initialEventDraftState.title)
  const [detailsExpanded, setDetailsExpanded] = useState(
    initialEventDraftState.detailsExpanded
  )
  const [details, setDetails] = useState(initialEventDraftState.details)

  const inferredType = useMemo(() => inferEventType(title), [title])
  const effectiveType = resolveEventType(eventType, inferredType)

  // Round to nearest STEP_MIN so every wheel label lands on a clean interval
  // (e.g. 4:26 → 4:30 instead of 4:26).
  const mountMinutes = useMemo(
    () => Math.round(minutesNow() / STEP_MIN) * STEP_MIN,
    []
  )
  const [startOffsetMin, setStartOffsetMin] = useState(
    initialEventDraftState.startOffsetMin
  )
  const [endOffsetMin, setEndOffsetMin] = useState(
    initialEventDraftState.endOffsetMin
  )

  // SCHEDULED mode
  const [startDate, setStartDate] = useState(initialEventDraftState.startDate)
  const [startTimeMin, setStartTimeMin] = useState(
    initialEventDraftState.startTimeMin
  )
  const [endTimeMin, setEndTimeMin] = useState(
    initialEventDraftState.endTimeMin
  )

  // WHERE
  const [whereType, setWhereType] = useState<WhereType>(
    initialEventDraftState.whereType
  )
  const [searchQuery, setSearchQuery] = useState(
    initialEventDraftState.searchQuery
  )
  const [pickedSearchAddress, setPickedSearchAddress] = useState(
    initialEventDraftState.pickedSearchAddress
  )
  const [selectedLocation, setSelectedLocation] =
    useState<DraftEventLocation | null>(initialEventDraftState.selectedLocation)
  const [placeResults, setPlaceResults] = useState<PlaceSuggestion[]>(
    initialEventDraftState.placeResults
  )
  const [placesLoading, setPlacesLoading] = useState(
    initialEventDraftState.placesLoading
  )
  const [placeDetailsLoading, setPlaceDetailsLoading] = useState(
    initialEventDraftState.placeDetailsLoading
  )
  const [placeDetailsError, setPlaceDetailsError] = useState<string | null>(
    initialEventDraftState.placeDetailsError
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const placesSearchRequestRef = useRef(0)
  const placeDetailsRequestRef = useRef(0)

  // GUESTS
  const [isOpen, setIsOpen] = useState(initialEventDraftState.isOpen)
  const [guestLimit, setGuestLimit] = useState(
    initialEventDraftState.guestLimit
  )
  const [audience, setAudience] = useState<Audience>(
    initialEventDraftState.audience
  )
  const defaultAudience = useMemo(
    () =>
      circles.find((c) => c.type === "close")?.id ??
      circles.find((c) => c.name.toLowerCase() === "close friends")?.id ??
      circles[0]?.id ??
      "",
    [circles]
  )
  const effectiveAudience = circles.some((c) => c.id === audience)
    ? audience
    : defaultAudience
  // Direct invites are extras on top of whatever circle is selected — they
  // become `members` on the create-event request alongside `circles`. Lets
  // the user pick inner + add a couple more people for this one event.
  const [directlyInvitedIds, setDirectlyInvitedIds] = useState<string[]>(
    initialEventDraftState.directlyInvitedIds
  )
  // Inner/Close are editable inline via long-press. This holds the id of the
  // circle currently being edited; null when no edit panel is open.
  const [editingCircleId, setEditingCircleId] = useState<string | null>(
    initialEventDraftState.editingCircleId
  )
  const [allowForward, setAllowForward] = useState(
    initialEventDraftState.allowForward
  )
  const [allowPlusOne, setAllowPlusOne] = useState(
    initialEventDraftState.allowPlusOne
  )
  const [submitError, setSubmitError] = useState<string | null>(
    initialEventDraftState.submitError
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetEventDraft = useCallback((): void => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    const initialState = getInitialEventDraftState()
    placesSearchRequestRef.current += 1
    placeDetailsRequestRef.current += 1
    setActiveSnapPoint(initialState.activeSnapPoint)
    setMode(initialState.mode)
    setEventType(initialState.eventType)
    setTypeOverrideOpen(initialState.typeOverrideOpen)
    setTitle(initialState.title)
    setDetailsExpanded(initialState.detailsExpanded)
    setDetails(initialState.details)
    setStartOffsetMin(initialState.startOffsetMin)
    setEndOffsetMin(initialState.endOffsetMin)
    setStartDate(initialState.startDate)
    setStartTimeMin(initialState.startTimeMin)
    setEndTimeMin(initialState.endTimeMin)
    setWhereType(initialState.whereType)
    setSearchQuery(initialState.searchQuery)
    setPickedSearchAddress(initialState.pickedSearchAddress)
    setSelectedLocation(initialState.selectedLocation)
    setPlaceResults(initialState.placeResults)
    setPlacesLoading(initialState.placesLoading)
    setPlaceDetailsLoading(initialState.placeDetailsLoading)
    setPlaceDetailsError(initialState.placeDetailsError)
    setIsOpen(initialState.isOpen)
    setGuestLimit(initialState.guestLimit)
    setAudience(initialState.audience)
    setDirectlyInvitedIds(initialState.directlyInvitedIds)
    setEditingCircleId(initialState.editingCircleId)
    setAllowForward(initialState.allowForward)
    setAllowPlusOne(initialState.allowPlusOne)
    setSubmitError(initialState.submitError)
  }, [])

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
    if (open) return
    queueMicrotask(() => setEditingCircleId(null))
  }, [open])

  useEffect(() => {
    if (!open || whereType !== "current" || geoStatus !== "idle") return
    requestGeoLocation()
  }, [open, whereType, geoStatus, requestGeoLocation])

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

  const currentLocation = useMemo<DraftEventLocation | null>(() => {
    if (!geoCoords) return null
    return {
      source: "current",
      name: "Current location",
      address: null,
      coordinates: [geoCoords.lng, geoCoords.lat],
    }
  }, [geoCoords])

  // Google Places search via /api/places proxy
  const searchPlaces = useCallback(async (query: string, requestId: number) => {
    if (query.trim().length < 2) {
      if (placesSearchRequestRef.current !== requestId) return
      setPlaceResults([])
      setPlacesLoading(false)
      return
    }
    setPlacesLoading(true)
    try {
      const resp = await fetch(
        `/api/places?input=${encodeURIComponent(query.trim())}`
      )
      if (!resp.ok) throw new Error("places error")
      const data = (await resp.json()) as { suggestions: PlaceSuggestion[] }
      if (placesSearchRequestRef.current !== requestId) return
      setPlaceResults(
        Array.isArray(data.suggestions)
          ? data.suggestions.filter(isPlaceSuggestion)
          : []
      )
    } catch {
      if (placesSearchRequestRef.current !== requestId) return
      setPlaceResults([])
    } finally {
      if (placesSearchRequestRef.current !== requestId) return
      setPlacesLoading(false)
    }
  }, [])

  const handleSearchQuery = (v: string): void => {
    const requestId = placesSearchRequestRef.current + 1
    placesSearchRequestRef.current = requestId
    placeDetailsRequestRef.current += 1
    setSearchQuery(v)
    setPickedSearchAddress("")
    setSelectedLocation(null)
    setPlaceResults([])
    setPlaceDetailsLoading(false)
    setPlaceDetailsError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void searchPlaces(v, requestId)
    }, 350)
  }

  const handleWhereType = (next: WhereType): void => {
    setWhereType(next)
    setPlaceDetailsError(null)
    if (next === "current") {
      placesSearchRequestRef.current += 1
      placeDetailsRequestRef.current += 1
      setSearchQuery("")
      setPickedSearchAddress("")
      setSelectedLocation(null)
      setPlaceResults([])
      setPlacesLoading(false)
      setPlaceDetailsLoading(false)
      if (geoStatus !== "granted" && geoStatus !== "requesting") {
        requestGeoLocation()
      }
    }
  }

  const handlePickSearch = async (
    suggestion: PlaceSuggestion
  ): Promise<void> => {
    const requestId = placeDetailsRequestRef.current + 1
    placeDetailsRequestRef.current = requestId
    setWhereType("search")
    setSearchQuery(suggestion.label)
    setPickedSearchAddress(suggestion.label)
    setSelectedLocation(null)
    setPlaceResults([])
    setPlaceDetailsError(null)
    setPlaceDetailsLoading(true)

    try {
      const resp = await fetch(
        `/api/places/${encodeURIComponent(suggestion.placeId)}`
      )
      if (!resp.ok) throw new Error("Place details unavailable.")
      const data: unknown = await resp.json()
      if (!isPlaceDetailsResponse(data)) {
        throw new Error("Place details unavailable.")
      }
      if (placeDetailsRequestRef.current !== requestId) return
      const location: DraftEventLocation = {
        source: "place",
        name: data.name,
        address: data.address,
        placeId: data.placeId,
        coordinates: [data.lng, data.lat],
      }
      setSelectedLocation(location)
      setSearchQuery(data.name)
      setPickedSearchAddress(data.name)
    } catch {
      if (placeDetailsRequestRef.current !== requestId) return
      setSelectedLocation(null)
      setPickedSearchAddress("")
      setPlaceDetailsError(
        "That place could not be resolved. Try another result."
      )
    } finally {
      if (placeDetailsRequestRef.current === requestId) {
        setPlaceDetailsLoading(false)
      }
    }
  }

  // Now-mode wheel options use absolute clock-time labels so the user sees
  // "9:30pm" instead of "+30m", matching the scheduled-mode wheel behavior.
  const nowStartOptions = useMemo(() => {
    const out: { value: number; label: string }[] = []
    for (let m = 0; m <= NOW_MAX_OFFSET_MIN; m += STEP_MIN) {
      const wallMin = (((mountMinutes + m) % 1440) + 1440) % 1440
      out.push({ value: m, label: m === 0 ? "now" : formatTimeOfDay(wallMin) })
    }
    return out
  }, [mountMinutes])

  const nowEndOptions = useMemo(() => {
    const out: { value: number; label: string }[] = []
    const min = startOffsetMin + MIN_DURATION_MIN
    const max = startOffsetMin + MAX_DURATION_MIN
    for (let m = min; m <= max; m += STEP_MIN) {
      const wallMin = (((mountMinutes + m) % 1440) + 1440) % 1440
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
    const startMin = (((mountMinutes + startOffsetMin) % 1440) + 1440) % 1440
    const endMin =
      endOffsetMin === OPEN_ENDED
        ? null
        : (((mountMinutes + endOffsetMin) % 1440) + 1440) % 1440
    return { startMin, endMin }
  }, [mountMinutes, startOffsetMin, endOffsetMin])

  const whereLabel = useMemo<string | null>(() => {
    if (whereType === "current") return "current loc"
    if (whereType === "search") {
      const v =
        selectedLocation?.name || pickedSearchAddress || searchQuery.trim()
      return v || null
    }
    return null
  }, [whereType, selectedLocation, pickedSearchAddress, searchQuery])

  const whenLabel = useMemo(() => {
    if (mode === "now") {
      if (endOffsetMin === OPEN_ENDED) return "now · open-ended"
      const dur = endOffsetMin - startOffsetMin
      return startOffsetMin === 0
        ? `now · ${formatRelative(dur)}`
        : `in ${formatRelative(startOffsetMin)} · ${formatRelative(dur)}`
    }
    const d = new Date(startDate + "T00:00:00")
    const chip = formatDayChip(d)
    return `${chip.weekday} ${formatTimeOfDay(startTimeMin)}`
  }, [mode, startOffsetMin, endOffsetMin, startDate, startTimeMin])

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

  // Compact audience label for the summary chip — folds headcount in so the
  // standalone "X people will see this" line can be dropped. Public events
  // show the cap instead of the current count (cap is the meaningful number
  // when anyone can join).
  const whoLabel = useMemo(() => {
    if (isOpen) return `public · up to ${guestLimit}`
    const circle = circles.find((c) => c.id === effectiveAudience)
    const baseName = circle?.name.toLowerCase() ?? "friends"
    return `${baseName} · ${inviteeCount}`
  }, [isOpen, circles, effectiveAudience, inviteeCount, guestLimit])

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) return
    setSubmitError(null)

    if (!isOpen && audienceLoading) {
      setSubmitError("Still loading your circles and friends.")
      return
    }
    if (!isOpen && audienceError) {
      setSubmitError(
        "Load your circles and friends before creating a private event."
      )
      return
    }

    const draftLocation =
      whereType === "current" ? currentLocation : selectedLocation

    if (!draftLocation) {
      if (whereType === "current") {
        if (geoStatus === "idle") requestGeoLocation()
        setSubmitError(currentLocationError(geoStatus))
      } else if (placeDetailsLoading) {
        setSubmitError("Still checking that place.")
      } else if (placeDetailsError) {
        setSubmitError(placeDetailsError)
      } else {
        setSubmitError("Pick a place from the search results before posting.")
      }
      return
    }

    setIsSubmitting(true)
    let created = false
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
        location: draftLocation,
        customWhere:
          whereType === "search"
            ? selectedLocation?.name || searchQuery.trim() || undefined
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
        timeRange
      )
      try {
        await createEvent(requestBody)
        created = true
        emitEventsChanged()
      } catch (err) {
        if (err instanceof HttpError) {
          const bodyIssues =
            err.details && typeof err.details === "object"
              ? (err.details as { body?: unknown }).body
              : undefined
          const firstIssue = Array.isArray(bodyIssues) ? bodyIssues[0] : null
          console.error(
            "[Sponti] POST /events failed",
            err.status,
            err.code,
            firstIssue ?? err.details,
            firstIssue
              ? {
                  path: firstIssue.path?.join("."),
                  message: firstIssue.message,
                }
              : undefined,
            requestBody
          )
        }
        throw err
      }
      haptic("success")
      onClose()
    } catch (error) {
      setSubmitError(formatSubmitError(error))
    } finally {
      setIsSubmitting(false)
      if (created) resetEventDraft()
    }
  }

  return (
    <>
      <Drawer.Root
        open={open}
        onOpenChange={(next) => {
          if (next) haptic("medium")
          else {
            haptic("light")
            onClose()
          }
        }}
        snapPoints={[0.55, 0.8, 0.95]}
        activeSnapPoint={activeSnapPoint}
        setActiveSnapPoint={(snap) => {
          haptic("selection")
          setActiveSnapPoint(snap)
        }}
        dismissible
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/25" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[95svh] flex-col rounded-t-3xl border-t border-border bg-card">
            {/* Drag handle */}
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />
            {/* Vaul uses Radix Dialog internally — DialogTitle required for a11y */}
            <Drawer.Title className="sr-only">light a flare</Drawer.Title>

            {/* Header zone — title + summary chips anchored as one unit */}
            <div className="shrink-0 border-b border-border/60">
              <div className="flex items-center justify-between px-4 pt-2 pb-1">
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5 text-lg font-semibold">
                  <Sparkles className="h-[18px] w-[18px]" />
                  <span>light a flare</span>
                </div>
                <div className="h-9 w-9" aria-hidden />
              </div>
              <SummaryRow
                whenLabel={whenLabel}
                whereLabel={whereLabel ?? "current loc"}
                whoLabel={whoLabel}
                whoOverLimit={isOverLimit}
                onTapWhen={() => focusSection(whenRef)}
                onTapWhere={() => focusSection(whereRef)}
                onTapWho={() => focusSection(whoRef)}
              />
            </div>

            {/* Scrollable form. The padding-bottom uses vaul's --snap-point-height
                (the drawer's translateY at the current snap) plus space for the
                CTA, so the last form field doesn't hide under the pinned CTA. */}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto"
              style={{
                paddingBottom: "calc(var(--snap-point-height, 0px) + 160px)",
              }}
              data-vaul-no-drag
            >
              <Tabs value={mode} onValueChange={handleModeChange}>
                <div className="px-4 pt-4 pb-0">
                  <TabsList className="h-9 w-full">
                    <TabsTrigger value="now" className="text-sm">
                      right now
                    </TabsTrigger>
                    <TabsTrigger value="scheduled" className="text-sm">
                      pick a time
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="px-4">
                  {/* 1. What — Title is the hero of the form. Type sits
                       inline below it as a small inferred-from-keywords hint
                       that can be overridden. */}
                  <Section label="what's the plan?" tight>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                      placeholder="let's get drinks after work"
                    />
                    {title.length > 60 && (
                      <p className="mt-1 text-right text-xs text-muted-foreground">
                        {80 - title.length} left
                      </p>
                    )}
                    <TypeInlineIndicator
                      effectiveType={effectiveType}
                      manualType={eventType}
                      isInferred={eventType === null && inferredType !== null}
                      overrideOpen={typeOverrideOpen}
                      onToggleOverride={() => setTypeOverrideOpen((v) => !v)}
                      onPick={(t) => {
                        setEventType(t)
                        setTypeOverrideOpen(false)
                      }}
                      onClearManual={() => {
                        setEventType(null)
                        setTypeOverrideOpen(false)
                      }}
                      detailsExpanded={detailsExpanded}
                      onExpandDetails={() => setDetailsExpanded(true)}
                    />
                    {detailsExpanded && (
                      <>
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
                        {details.length > 160 && (
                          <p className="mt-1 text-right text-xs text-muted-foreground">
                            {200 - details.length} left
                          </p>
                        )}
                      </>
                    )}
                  </Section>

                  {/* 3. When */}
                  <div ref={whenRef} className="scroll-mt-2">
                    <TabsContent value="now" className="m-0">
                      <Section label="how long should it last?">
                        {/* Right Now assumes start = now. Picking a duration
                            chip sets endOffsetMin directly (since
                            startOffsetMin is forced to 0). Horizontal scroll
                            handles overflow on narrow viewports. */}
                        <NowDurationChips
                          value={endOffsetMin}
                          onChange={(v) => {
                            setStartOffsetMin(0)
                            setEndOffsetMin(v)
                          }}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          starts now
                          {endOffsetMin === OPEN_ENDED
                            ? " · open-ended"
                            : ` · ${formatRelative(endOffsetMin)}`}
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
                  </div>

                  {/* 4. Where */}
                  <div ref={whereRef} className="scroll-mt-2">
                    <Section label="where do you want to meet?">
                      <WherePicker
                        whereType={whereType}
                        onWhereType={handleWhereType}
                        searchQuery={searchQuery}
                        onSearchQuery={handleSearchQuery}
                        pickedSearchAddress={pickedSearchAddress}
                        selectedLocation={selectedLocation}
                        onPickSearch={(suggestion) => {
                          void handlePickSearch(suggestion)
                        }}
                        placeResults={placeResults}
                        placesLoading={placesLoading}
                        placeDetailsLoading={placeDetailsLoading}
                        placeDetailsError={placeDetailsError}
                        geoStatus={geoStatus}
                        geoErrorMessage={geoErrorMessage}
                      />
                    </Section>
                  </div>

                  {/* 5. Who */}
                  <div ref={whoRef} className="scroll-mt-2">
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
                              : [...prev, id]
                          )
                        }
                        allowForward={allowForward}
                        onAllowForward={setAllowForward}
                        allowPlusOne={allowPlusOne}
                        onAllowPlusOne={setAllowPlusOne}
                      />
                    </Section>
                  </div>
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
                  (!isOpen && (audienceLoading || Boolean(audienceError))) ||
                  (whereType === "search" && placeDetailsLoading) ||
                  (whereType === "current" &&
                    geoStatus === "requesting" &&
                    !currentLocation)
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

// ----- Summary chip row -----

// Sits between the mode tabs and the form sections. Surfaces the three
// implicit defaults (when, where, who) so the user knows exactly what'll
// ship from the 0.55 peek snap — no scrolling needed. Each chip is a
// shortcut: tap to expand the drawer to 0.95 and scroll to that section.
function SummaryRow({
  whenLabel,
  whereLabel,
  whoLabel,
  whoOverLimit,
  onTapWhen,
  onTapWhere,
  onTapWho,
}: {
  whenLabel: string
  whereLabel: string
  whoLabel: string
  whoOverLimit: boolean
  onTapWhen: () => void
  onTapWhere: () => void
  onTapWho: () => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5 px-4 pt-1 pb-2.5">
      <SummaryChip label={whenLabel} onClick={onTapWhen} />
      <SummaryChip label={whereLabel} onClick={onTapWhere} />
      <SummaryChip
        label={whoLabel}
        onClick={onTapWho}
        tone={whoOverLimit ? "destructive" : "default"}
      />
    </div>
  )
}

function SummaryChip({
  label,
  onClick,
  tone = "default",
}: {
  label: string
  onClick: () => void
  tone?: "default" | "destructive"
}) {
  const toneClasses =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
      : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 truncate rounded-full border px-3 py-1 text-xs transition-colors ${toneClasses}`}
    >
      {label}
    </button>
  )
}

// ----- Event type -----

// Tiny inline indicator that lives under the title. Shows the type that will
// actually ship (inferred from title keywords, or user-picked). Tap "change"
// to expand the full pill row; pick or clear collapses it back.
function TypeInlineIndicator({
  effectiveType,
  manualType,
  isInferred,
  overrideOpen,
  onToggleOverride,
  onPick,
  onClearManual,
  detailsExpanded,
  onExpandDetails,
}: {
  effectiveType: EventType
  manualType: EventType | null
  isInferred: boolean
  overrideOpen: boolean
  onToggleOverride: () => void
  onPick: (t: EventType) => void
  onClearManual: () => void
  detailsExpanded: boolean
  onExpandDetails: () => void
}) {
  const meta = EVENT_TYPES.find((t) => t.value === effectiveType)
  if (!meta) return null
  const Icon = meta.icon

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span>type · {meta.label}</span>
        {isInferred && <span className="text-muted-foreground/60">(auto)</span>}
        <button
          type="button"
          onClick={onToggleOverride}
          className="text-accent hover:underline"
        >
          {overrideOpen ? "done" : "change"}
        </button>
        {manualType !== null && !overrideOpen && (
          <button
            type="button"
            onClick={onClearManual}
            className="text-muted-foreground hover:text-foreground"
          >
            · reset
          </button>
        )}
        {!detailsExpanded && (
          <button
            type="button"
            onClick={onExpandDetails}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            + add a note
          </button>
        )}
      </div>
      {overrideOpen && (
        <EventTypePills
          value={manualType ?? effectiveType}
          onChange={(t) => {
            // Tapping the same pill toggles it off — reset to inference.
            if (t === null) onClearManual()
            else onPick(t)
          }}
        />
      )}
    </div>
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

// ----- Right Now duration chips -----

// Compact horizontal scrollable chip row for the spontaneous flow. Replaces
// the twin scroll wheels which trapped vertical-scroll gestures in a narrow
// drawer. Start is always "now" in this mode — if the user needs a delayed
// start they should switch to "pick a time".
const NOW_DURATION_PRESETS: { value: number; label: string }[] = [
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 180, label: "3h" },
  { value: 240, label: "4h" },
  { value: OPEN_ENDED, label: "open" },
]

function NowDurationChips({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="-mx-4 no-scrollbar overflow-x-auto px-4">
      <div className="flex gap-2">
        {NOW_DURATION_PRESETS.map((p) => {
          const selected = value === p.value
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                selected
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-border text-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
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

// "current loc" is the default; the search field hides behind a magnifier
// icon to reclaim vertical space. Tapping the icon expands the input inline
// and focuses it; tapping the X collapses back to "current loc". Picking a
// place from the autocomplete list keeps the field open so the user can see
// what was picked.
function WherePicker({
  whereType,
  onWhereType,
  searchQuery,
  onSearchQuery,
  pickedSearchAddress,
  selectedLocation,
  onPickSearch,
  placeResults,
  placesLoading,
  placeDetailsLoading,
  placeDetailsError,
  geoStatus,
  geoErrorMessage,
}: {
  whereType: WhereType
  onWhereType: (v: WhereType) => void
  searchQuery: string
  onSearchQuery: (v: string) => void
  pickedSearchAddress: string
  selectedLocation: DraftEventLocation | null
  onPickSearch: (v: PlaceSuggestion) => void
  placeResults: PlaceSuggestion[]
  placesLoading: boolean
  placeDetailsLoading: boolean
  placeDetailsError: string | null
  geoStatus: GeoStatus
  geoErrorMessage: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const expanded = whereType === "search"
  const currentHint =
    geoStatus === "requesting"
      ? "finding your location..."
      : geoStatus === "denied" ||
          geoStatus === "unavailable" ||
          geoStatus === "error"
        ? (geoErrorMessage ?? currentLocationError(geoStatus))
        : null

  const expand = (): void => {
    onWhereType("search")
    // Focus the input on the next frame, after the input mounts.
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  const collapse = (): void => {
    onWhereType("current")
    onSearchQuery("")
  }

  return (
    <div className="flex flex-col gap-2">
      {!expanded ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Chip selected onClick={() => undefined}>
              <MapPin className="h-3.5 w-3.5" />
              current loc
            </Chip>
            <button
              type="button"
              onClick={expand}
              aria-label="Search for a place"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
          {currentHint && (
            <p
              className={`text-xs ${
                geoStatus === "requesting"
                  ? "text-muted-foreground"
                  : "text-destructive"
              }`}
            >
              {currentHint}
            </p>
          )}
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="search for a place"
              value={searchQuery}
              onChange={(e) => onSearchQuery(e.target.value)}
              className="pr-9 pl-9"
            />
            <button
              type="button"
              onClick={collapse}
              aria-label="Use current location instead"
              className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {placesLoading && (
            <p className="mt-1.5 text-xs text-muted-foreground">searching…</p>
          )}
          {placeDetailsLoading && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              checking place...
            </p>
          )}
          {placeDetailsError && (
            <p className="mt-1.5 text-xs text-destructive" role="alert">
              {placeDetailsError}
            </p>
          )}
          {selectedLocation && !placeDetailsLoading && (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              selected - {selectedLocation.address ?? selectedLocation.name}
            </p>
          )}
          {!placesLoading &&
            !placeDetailsLoading &&
            !pickedSearchAddress &&
            !selectedLocation &&
            placeResults.length > 0 && (
              <ul className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card">
                {placeResults.map((r) => (
                  <li key={r.placeId}>
                    <button
                      type="button"
                      onClick={() => onPickSearch(r)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-secondary"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{r.label}</div>
                        <div className="truncate text-xs text-muted-foreground">
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

  // The cap only matters when the headcount isn't already bounded by a
  // curated list. Public events need a cap (anyone can join) and "all
  // friends" can be sizeable. Inner/Close are already capped by membership.
  const allCircleId = circles.find((c) => c.type === "all")?.id ?? ""
  const showLimit = isOpen || audience === allCircleId

  return (
    <div className="flex flex-col gap-3">
      {/* Public toggle + (conditional) guest-limit stepper. Limit only
          renders when it's meaningful: public events or "all friends" — for
          inner/close, the audience IS the cap. */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
          isOpen ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <Switch checked={isOpen} onCheckedChange={onOpen} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          public
        </span>
        <>
          <div className="h-7 w-px shrink-0 bg-border" />
          <span className="shrink-0 text-xs text-muted-foreground">limit</span>
          <Stepper
            value={guestLimit}
            onChange={onGuestLimit}
            min={1}
            max={200}
          />
        </>
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
    (c) => c.type === "inner" || c.type === "close" || c.type === "all"
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
  const scaleClasses = editable ? "hover:scale-[1.03] active:scale-[1.06]" : ""

  return (
    <button
      type="button"
      {...buttonHandlers}
      className={`relative flex touch-none items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 py-2 transition-transform duration-150 select-none ${scaleClasses} ${
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
    <div className="flex min-h-0 flex-col gap-2 rounded-xl border border-accent bg-accent/5 p-3">
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

// Optional amplifier on top of whatever circle is the audience — pick a few
// specific people to invite directly for this one event. Collapsed by default
// so it doesn't eat ~200px when the user has no extras to add. The trigger
// shows a running count when non-zero, so the user can still see at a glance
// who's coming along.
function DirectInviteSearch({
  connections,
  directlyInvitedIds,
  onToggle,
}: {
  connections: Connection[]
  directlyInvitedIds: string[]
  onToggle: (id: string) => void
}) {
  // Keep expanded once the user adds anyone — collapsing with people selected
  // would hide state from the user and feel like a bug.
  const hasSelection = directlyInvitedIds.length > 0
  const [expanded, setExpanded] = useState(false)
  const isOpen = expanded || hasSelection

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <UserPlus className="h-3.5 w-3.5" />
        also invite specific friends
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          also invite specifically
          {hasSelection && (
            <span className="ml-1 text-accent">
              · {directlyInvitedIds.length} selected
            </span>
          )}
        </span>
        {!hasSelection && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Collapse direct invites"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
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
        c.username.toLowerCase().includes(q)
    )
  }, [connections, query])

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Input
        placeholder={searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul
        className="-mx-1 max-h-48 overflow-y-auto overscroll-contain"
        data-vaul-no-drag
      >
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
    </div>
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
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
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
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
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
  tight = false,
}: {
  label: string
  children: React.ReactNode
  tight?: boolean
}) {
  return (
    <div className={tight ? "mt-4" : "mt-6"}>
      <Label className="mb-2 block text-sm font-medium text-foreground">
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
