"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APILoadingStatus,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps"
import { Card } from "@/components/ui/card"
import {
  ChevronRight,
  ChevronDown,
  Check,
  Flame,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  AlertCircle,
  Calendar as CalendarIcon,
  Expand,
  EyeOff,
  Users,
  X,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  distanceFromUser,
  eventCoords,
  EventType,
  formatDistance,
  formatRelativeStatus,
  haversineMeters,
  isJoined,
  isLive,
  type EventItem,
} from "@/lib/api/events"
import {
  useGeolocation,
  type GeoCoords,
  type GeoStatus,
} from "@/lib/geolocation"
import { useMapEvents } from "@/lib/use-events"
import { useSlowRequestHint } from "@/lib/use-slow-request-hint"
import { setSuggestedFlareType } from "@/lib/suggested-flare-type"
import { getIdeaPins, getIdeasNear, type FlareIdea } from "@/lib/flare-ideas"
import { haptic } from "@/lib/haptics"
import { setIdeasHidden, useIdeasHidden } from "@/lib/idea-preferences"
import { useOptionalActionFeedback } from "@/components/action-feedback"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import type { ComposerPrefill } from "@/components/new-event-drawer"
import { computeRoute, type RouteResult } from "@/lib/routes-api"
import {
  FitBoundsOnce,
  GoogleMapPolyline,
} from "@/components/google-map-overlays"
import { EVENT_TYPES } from "@/types/utils"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { useTheme } from "next-themes"

function eventIcon(type: EventType, avatar: string) {
  const match = EVENT_TYPES.find((t) => t.value === type)

  if (!match) {
    return <>{avatar}</>
  }

  const Icon = match.icon

  return <Icon className="h-5 w-5 shrink-0 text-accent" />
}

// What the map draws for an idea (#244). Deliberately the opposite of a flare
// pin: smaller, filled with the muted chip colour, a dashed outline and a grey
// icon, and no peach anywhere (peach is the CTA colour and means "a real
// flare"). The dashed outline reads as "a suggestion, nothing planned here" in
// both light and dark. The padding is only a bigger touch target.
function IdeaPinMark({
  idea,
  selected,
}: {
  idea: FlareIdea
  selected: boolean
}) {
  const match = EVENT_TYPES.find((t) => t.value === idea.category)
  const Icon = match?.icon ?? MapPin
  return (
    <div className="flex cursor-pointer items-center justify-center p-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full border border-dashed bg-muted text-muted-foreground shadow-md transition-transform duration-200 ${
          selected
            ? "scale-125 border-foreground/70 text-foreground"
            : "border-muted-foreground/70"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

// Where idea pins sit on the static fallback, which has no real projection
// (its flare pins are pseudo-positioned too): percent from the top-left, chosen
// to stay clear of the flare slots, the header chips and the dock.
const IDEA_PIN_SLOTS = [
  { top: "24%", left: "46%" },
  { top: "40%", left: "9%" },
  { top: "40%", left: "62%" },
  { top: "22%", left: "8%" },
  { top: "47%", left: "36%" },
]

function StaticMapFallback({
  events,
  onEventSelect,
  joinedIds,
  user,
  highlightId = null,
  ideas = [],
  selectedIdeaId = null,
  onIdeaSelect,
}: {
  events: EventItem[]
  onEventSelect: (event: EventItem) => void
  joinedIds: Set<string>
  user: GeoCoords
  /** The flare whose rail card is centred; its pin grows. */
  highlightId?: string | null
  ideas?: FlareIdea[]
  selectedIdeaId?: string | null
  onIdeaSelect?: (idea: FlareIdea) => void
}) {
  return (
    <div className="relative h-full w-full bg-muted">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
      </div>
      {ideas.map((idea, i) => (
        <button
          key={idea.id}
          type="button"
          data-idea-pin={idea.id}
          aria-label={`idea: ${idea.title}`}
          onClick={() => onIdeaSelect?.(idea)}
          style={IDEA_PIN_SLOTS[i % IDEA_PIN_SLOTS.length]}
          className="absolute z-[1]"
        >
          <IdeaPinMark idea={idea} selected={selectedIdeaId === idea.id} />
        </button>
      ))}
      {events.slice(0, 4).map((event, i) => {
        // Pseudo positions around the center so the static fallback is readable
        const positions = [
          { top: "30%", left: "26%" },
          { top: "55%", right: "14%" },
          { top: "68%", left: "32%" },
          { top: "22%", right: "22%" },
        ]
        const pos = positions[i % positions.length]
        const dist = distanceFromUser(event, user)?.label ?? ""
        return (
          <button
            key={event.id}
            onClick={() => onEventSelect(event)}
            style={pos}
            className={`absolute flex cursor-pointer flex-col items-center ${
              highlightId === event.id ? "z-10" : ""
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent bg-background text-sm font-medium shadow-lg transition-transform duration-200 ${
                isJoined(event, joinedIds)
                  ? "ring-2 ring-accent ring-offset-2"
                  : ""
              } ${highlightId === event.id ? "scale-125" : ""}`}
            >
              {eventIcon(event.type, event.host.avatar)}
            </div>
            <div className="mt-1 rounded bg-card px-2 py-1 text-center text-xs shadow-md">
              <span className="font-medium">{event.title.split("·", 2)}</span>
              {dist && (
                <>
                  <br />
                  <span className="text-muted-foreground">{dist}</span>
                </>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function GoogleMapContent({
  events,
  onEventSelect,
  previewEvent,
  setPreviewEvent,
  routeResult,
  routeDestination,
  joinedIds,
  cameraCenter,
  currentLocation,
  recenterTick,
  highlightId,
  ideas,
  selectedIdeaId,
  onIdeaSelect,
}: {
  events: EventItem[]
  onEventSelect: (event: EventItem) => void
  previewEvent: EventItem | null
  setPreviewEvent: React.Dispatch<React.SetStateAction<EventItem | null>>
  routeResult: RouteResult | null
  routeDestination: GeoCoords | null
  joinedIds: Set<string>
  cameraCenter: GeoCoords
  currentLocation: GeoCoords | null
  recenterTick: number
  /** The flare whose rail card is centred; its pin grows. */
  highlightId: string | null
  ideas: FlareIdea[]
  selectedIdeaId: string | null
  onIdeaSelect: (idea: FlareIdea) => void
}) {
  const status = useApiLoadingStatus()
  const map = useMap()
  const { resolvedTheme } = useTheme()
  const autoCenteredRef = useRef(false)
  const colorScheme = resolvedTheme === "dark" ? "DARK" : "LIGHT"
  const userInteractedRef = useRef(false)

  // If the map opened from a cached camera, move to fresh GPS once it arrives,
  // but only while the user has not started navigating the map themselves.
  useEffect(() => {
    if (
      !map ||
      autoCenteredRef.current ||
      !currentLocation ||
      userInteractedRef.current
    )
      return
    autoCenteredRef.current = true
    map.panTo(currentLocation)
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
  }, [map, currentLocation])

  // Recenter on explicit user action
  useEffect(() => {
    if (!map || recenterTick === 0 || !currentLocation) return
    userInteractedRef.current = false
    map.panTo(currentLocation)
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
  }, [map, currentLocation, recenterTick])

  if (status === APILoadingStatus.FAILED) {
    return (
      <StaticMapFallback
        events={events}
        onEventSelect={onEventSelect}
        joinedIds={joinedIds}
        user={cameraCenter}
        highlightId={highlightId}
        ideas={ideas}
        selectedIdeaId={selectedIdeaId}
        onIdeaSelect={onIdeaSelect}
      />
    )
  }

  return (
    <Map
      defaultCenter={cameraCenter}
      defaultZoom={15}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      colorScheme={colorScheme}
      reuseMaps
      disableDefaultUI
      gestureHandling="greedy"
      className="h-full w-full"
      onDragstart={() => {
        userInteractedRef.current = true
      }}
      onCameraChanged={(event) => {
        if (event.domEvent) userInteractedRef.current = true
      }}
    >
      {currentLocation && (
        <AdvancedMarker position={currentLocation}>
          <div className="relative flex items-center justify-center">
            <span className="absolute h-4 w-4 animate-ping rounded-full bg-blue-400/40" />
            <div className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
          </div>
        </AdvancedMarker>
      )}
      {ideas.map((idea) => (
        <AdvancedMarker
          key={`idea:${idea.id}`}
          position={idea.place}
          anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
          title={idea.title}
          zIndex={selectedIdeaId === idea.id ? 400 : 0}
          onClick={() => onIdeaSelect(idea)}
        >
          <div
            data-idea-pin={idea.id}
            role="button"
            aria-label={`idea: ${idea.title}`}
          >
            <IdeaPinMark idea={idea} selected={selectedIdeaId === idea.id} />
          </div>
        </AdvancedMarker>
      ))}
      {events.map((event) => {
        const coords = eventCoords(event)
        if (!coords) return null
        return (
          <AdvancedMarker
            key={event.id}
            position={coords}
            zIndex={highlightId === event.id ? 500 : undefined}
            onClick={() =>
              setPreviewEvent((prev) => (prev?.id === event.id ? null : event))
            }
          >
            <div className="flex cursor-pointer flex-col items-center">
              <div className="relative flex items-center justify-center">
                {isLive(event) && (
                  <span
                    aria-hidden="true"
                    className="animate-pulse-ring absolute h-8 w-8 rounded-full bg-accent"
                  />
                )}
                <div
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent bg-background text-xs font-medium shadow-lg transition-transform duration-200 ${
                    isJoined(event, joinedIds)
                      ? "ring-2 ring-accent ring-offset-2"
                      : ""
                  } ${highlightId === event.id ? "scale-125" : ""}`}
                >
                  {eventIcon(event.type, event.host.avatar)}
                </div>
              </div>
              {isLive(event) && (
                <div className="mt-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground shadow">
                  live
                </div>
              )}
            </div>
          </AdvancedMarker>
        )
      })}
      {previewEvent && eventCoords(previewEvent) && (
        <AdvancedMarker position={eventCoords(previewEvent)!} zIndex={1000}>
          <div className="relative mb-10 flex origin-bottom animate-[scale-in_150ms_ease-out] flex-col items-center">
            <div className="relative w-52 rounded-2xl border border-border/60 bg-background p-3.5 shadow-xl">
              <button
                type="button"
                onClick={() => setPreviewEvent(null)}
                className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onEventSelect(previewEvent)
                  setPreviewEvent(null)
                }}
                className="flex w-full flex-col items-center gap-1.5 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                  {eventIcon(previewEvent.type, previewEvent.host.avatar)}
                </div>
                <p className="line-clamp-2 text-sm font-semibold text-foreground">
                  {previewEvent.title.split("·", 2)[0]}
                </p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {previewEvent.location.name}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{previewEvent.going} going</span>
                  <span className="text-border">·</span>
                  <span>
                    by {previewEvent.host.name.trim().split(/\s+/)[0]}
                  </span>
                </div>
              </button>
            </div>
            <div className="h-0 w-0 border-x-[8px] border-t-[8px] border-x-transparent border-t-background" />
          </div>
        </AdvancedMarker>
      )}
      {routeResult && <GoogleMapPolyline path={routeResult.path} />}
      {routeDestination && (
        <FitBoundsOnce
          origin={currentLocation ?? cameraCenter}
          destination={routeDestination}
        />
      )}
    </Map>
  )
}

// Variant C of #223: no draggable sheet. The dock (filter bar, plus the FAB
// at peek or the card rail at mid) and the full list page are fixed to
// bottom: var(--sponti-nav-h), the same coordinate system as the nav, so
// they sit flush on it in every browser mode and never cover it. Buttons
// switch the state; a vertical swipe on the dock is only a shortcut.
//   peek: filter bar + FAB
//   mid:  filter bar + a horizontal card rail
//   full: a plain list page from under the header chips down to the nav
export type DockState = "peek" | "mid" | "full"

// BottomNav writes its rendered height (incl. safe-area inset) to
// --sponti-nav-h. The fallback covers the first paint before its
// ResizeObserver fires.
const NAV_RESERVED_CSS = "var(--sponti-nav-h, 64px)"

// Space the header chip row needs at the top: the same offset page.tsx gives
// that row, plus the 42px view toggle and a gap. The full list page starts
// below it so the map/calendar toggle stays reachable.
const TOP_RESERVED_CSS = "calc(max(0.75rem, env(safe-area-inset-top)) + 3.5rem)"

// The curve and duration vaul uses, so the list page moves like the app's
// other sheets.
const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)"

// Distance from the viewport bottom to the top of whatever is docked at the
// bottom, published on the document root the same way BottomNav publishes
// --sponti-nav-h. The map view is the only writer (see the effect below); it
// resets the property on unmount so other routes fall back to plain
// --sponti-nav-h. Bottom-docked UI that isn't part of the dock/nav, e.g.
// the ActionFeedbackProvider toast, reads this instead of assuming the nav
// is the only thing at the bottom of the screen (#112).
export function bottomOccupiedCss(state: DockState, dockPx: number): string {
  // The full list page ends at the nav, and bottom-docked UI should float
  // just above the nav rather than halfway up the list.
  if (state === "full") return NAV_RESERVED_CSS
  // Peek and mid: the dock sits on the nav, so reserve both.
  return `calc(${NAV_RESERVED_CSS} + ${Math.round(dockPx)}px)`
}

// The quiet state (#223): exactly one type chip is on and no flare of that
// type is live right now. The map then suggests lighting one (a floating
// card above the dock) and the nav's flare button shows the type's icon.
// Upcoming flares of the type don't count: nothing is happening *now*.
export function quietFlareType(
  types: ReadonlySet<EventType>,
  events: readonly EventItem[],
  now: number
): EventType | null {
  if (types.size !== 1) return null
  const [type] = types
  const liveOfType = events.some((e) => {
    if (e.type !== type) return false
    const start = new Date(e.startAt).getTime()
    const end = new Date(e.endAt).getTime()
    return now >= start && now <= end
  })
  return liveOfType ? null : type
}

// The idea shown on the quiet card (#243): the nearest idea of the selected
// type within 2 km of where the map is centred, or null (generic card) when
// there is none or the position is unknown. Same clock as the rest of the map.
export function quietIdea(
  center: GeoCoords | null,
  type: EventType,
  now: number
): FlareIdea | null {
  if (!center || now <= 0) return null
  return (
    getIdeasNear({ center, now: new Date(now), category: type, limit: 1 })[0] ??
    null
  )
}

// What the composer opens with when an idea is lit.
export function ideaPrefill(idea: FlareIdea): ComposerPrefill {
  return {
    title: idea.title,
    category: idea.category,
    place: {
      source: "place",
      name: idea.place.name,
      address: idea.place.address,
      coordinates: [idea.place.lng, idea.place.lat],
    },
  }
}

// One-shot dev warning: AdvancedMarker silently renders nothing when the map
// has no mapId. Surfacing this early saves a debugging session.
let warnedNoMapId = false
function warnIfMissingMapId(
  apiKey: string | undefined,
  mapId: string | undefined
): void {
  if (warnedNoMapId) return
  if (apiKey && !mapId && process.env.NODE_ENV !== "production") {
    warnedNoMapId = true
    console.warn(
      "[Sponti] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set but NEXT_PUBLIC_GOOGLE_MAPS_ID is not — AdvancedMarker will render blank. Add a Map ID in the Google Cloud console."
    )
  }
}

// Default + widened radii for the empty-state pivot. If 10 km nearby is empty,
// the user can opt into 20 km. Beyond that, we suggest the calendar view.
const DEFAULT_RADIUS_KM = 10
const WIDE_RADIUS_KM = 20

export function MapView({
  onEventSelect,
  activeRoute,
  joinedIds,
  onRouteReady,
  onSeeCalendar,
}: {
  onEventSelect: (event: EventItem) => void
  activeRoute: EventItem | null
  joinedIds: Set<string>
  onRouteReady?: (event: EventItem, etaLabel: string) => void
  onSeeCalendar?: () => void
}) {
  const { open: composeOpen, openDrawer } = useNewEventDrawer()
  const router = useRouter()
  // Always opens at mid (the prototype's default): the rail shows what's on
  // without covering the map. Not remembered across visits.
  const [dock, setDock] = useState<DockState>("mid")
  const dockRef = useRef<HTMLDivElement | null>(null)
  const [dockPx, setDockPx] = useState(0)

  // Track the dock's rendered height (it grows with the rail, the quiet
  // card, or wrapping chips) for --sponti-bottom-occupied.
  useEffect(() => {
    const el = dockRef.current
    if (!el) return
    const write = () => setDockPx(el.offsetHeight)
    write()
    const ro = new ResizeObserver(write)
    ro.observe(el, { box: "border-box" })
    return () => ro.disconnect()
  }, [])

  // Publish --sponti-bottom-occupied so bottom-docked UI outside this
  // component (the action-feedback toast) can sit above the dock instead of
  // assuming the nav is the only thing docked at the bottom. Reset on
  // unmount (not on every change) so other routes cleanly fall back to
  // --sponti-nav-h instead of flashing an unset value between writes.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sponti-bottom-occupied",
      bottomOccupiedCss(dock, dockPx)
    )
  }, [dock, dockPx])
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--sponti-bottom-occupied")
    }
  }, [])

  // Long-press on the map canvas → open flare creation drawer.
  // 500 ms is the standard long-press threshold on mobile.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return // let map controls handle their own events
    longPressTimer.current = setTimeout(() => {
      haptic("medium")
      openDrawer()
      longPressTimer.current = null
    }, 500)
  }
  const handleMapPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID
  warnIfMissingMapId(apiKey, mapId)
  const [recenterTick, setRecenterTick] = useState(0)

  const geo = useGeolocation()
  const cameraCenter = geo.coords ?? geo.lastKnownCoords
  const hasCurrentLocation = geo.coords != null
  const isUsingCachedLocation =
    !hasCurrentLocation && geo.lastKnownCoords != null
  // The recenter button only makes sense on a real interactive map.
  const hasInteractiveMap = !!apiKey && cameraCenter != null

  const [searchRadiusKm, setSearchRadiusKm] = useState(DEFAULT_RADIUS_KM)
  const [typeFilters, setTypeFilters] = useState<Set<EventType>>(new Set())
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all")
  const [showEnded, setShowEnded] = useState(false)
  const [previewEvent, setPreviewEvent] = useState<EventItem | null>(null)
  // The rail card nearest the rail's centre; its pin is highlighted.
  const [railFocusId, setRailFocusId] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(0)
  useEffect(() => {
    const updateNow = () => setNowMs(Date.now())
    updateNow()
    const id = window.setInterval(updateNow, 60_000)
    return () => window.clearInterval(id)
  }, [])
  const map = useMapEvents(cameraCenter, searchRadiusKm)
  // #171: the first flares fetch after a cold backend can take up to a
  // minute — say so instead of a "loading" label that just sits there.
  const mapWakingUp = useSlowRequestHint(map.loading)
  const mapEvents = useMemo(
    () => map.events.filter((e) => !!e.location.coordinates),
    [map.events]
  )
  const groupedEvents = useMemo(() => {
    const now = nowMs
    const live: EventItem[] = []
    const upcoming: EventItem[] = []
    const ended: EventItem[] = []
    for (const e of mapEvents) {
      if (typeFilters.size > 0 && !typeFilters.has(e.type)) continue
      const start = new Date(e.startAt).getTime()
      const end = new Date(e.endAt).getTime()
      if (now >= start && now <= end) live.push(e)
      else if (start > now) upcoming.push(e)
      else ended.push(e)
    }
    // Live ends soonest first, upcoming starts soonest first, ended most-recent first.
    live.sort(
      (a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
    )
    upcoming.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )
    ended.sort(
      (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
    )
    return { live, upcoming, ended }
  }, [mapEvents, nowMs, typeFilters])
  const visibleEvents = useMemo(() => {
    if (timeFilter === "live") return groupedEvents.live
    if (timeFilter === "upcoming") return groupedEvents.upcoming
    return [...groupedEvents.live, ...groupedEvents.upcoming]
  }, [groupedEvents, timeFilter])
  const activeCount = groupedEvents.live.length + groupedEvents.upcoming.length
  const endedVisible = timeFilter === "all" && groupedEvents.ended.length > 0
  const mapFailedEmpty = !!map.error && mapEvents.length === 0

  // Quiet state: only once the results are real (location known, loaded, no
  // failed first fetch), so the card never flashes during a load.
  const quietType =
    cameraCenter && nowMs > 0 && !map.loading && !mapFailedEmpty
      ? quietFlareType(typeFilters, mapEvents, nowMs)
      : null
  const quietTypeInfo = quietType
    ? EVENT_TYPES.find((t) => t.value === quietType)
    : undefined
  // Tell the nav which type to show on its flare button. Reset on unmount so
  // leaving the map (another route, or the calendar view) restores the flame.
  useEffect(() => {
    setSuggestedFlareType(quietType)
  }, [quietType])
  useEffect(() => () => setSuggestedFlareType(null), [])

  // Keyed on the primitives so the pick only changes when the inputs do,
  // not on every render (the position object is a fresh one per fix).
  const centerLat = cameraCenter?.lat
  const centerLng = cameraCenter?.lng
  // "hide ideas" (#245) is a device setting: with it on there are no idea
  // pins and no idea card, and the quiet state is the generic card.
  const ideasHidden = useIdeasHidden()
  const { showActionFeedback } = useOptionalActionFeedback()
  const idea = useMemo(
    () =>
      !ideasHidden && quietType && centerLat != null && centerLng != null
        ? quietIdea({ lat: centerLat, lng: centerLng }, quietType, nowMs)
        : null,
    [ideasHidden, quietType, centerLat, centerLng, nowMs]
  )

  // Idea pins (#244): the curated ideas around the camera, for the chips that
  // are on (all of them with none on), minus any that would sit on a flare's
  // pin. Held back while the flares load so a pin never flashes and then
  // vanishes under a flare that arrives a moment later.
  const flarePositions = useMemo(
    () =>
      mapEvents.flatMap((e) => {
        const coords = eventCoords(e)
        return coords ? [coords] : []
      }),
    [mapEvents]
  )
  const ideaPins = useMemo(
    () =>
      !ideasHidden &&
      centerLat != null &&
      centerLng != null &&
      nowMs > 0 &&
      !map.loading
        ? getIdeaPins({
            center: { lat: centerLat, lng: centerLng },
            now: new Date(nowMs),
            categories: typeFilters,
            flarePositions,
          })
        : [],
    [
      ideasHidden,
      centerLat,
      centerLng,
      nowMs,
      map.loading,
      typeFilters,
      flarePositions,
    ]
  )
  // The idea the person tapped on the map. Looked up in the current pins, so
  // it closes by itself if a chip or the clock takes its pin away.
  const [tappedIdeaId, setTappedIdeaId] = useState<string | null>(null)
  const tappedIdea = ideaPins.find((i) => i.id === tappedIdeaId) ?? null
  const tappedIdeaType = tappedIdea
    ? EVENT_TYPES.find((t) => t.value === tappedIdea.category)
    : undefined
  const selectIdeaPin = (pin: FlareIdea) => {
    haptic("selection")
    setPreviewEvent(null)
    setTappedIdeaId((prev) => (prev === pin.id ? null : pin.id))
  }
  const hideIdeas = () => {
    haptic("light")
    setTappedIdeaId(null)
    setIdeasHidden(true)
    showActionFeedback("ideas hidden · see settings", {
      action: { label: "undo", onAction: () => setIdeasHidden(false) },
    })
  }
  // The pin of the idea on screen grows: the tapped one, else the quiet card's.
  const selectedIdeaId = tappedIdea?.id ?? idea?.id ?? null

  const showRail = dock === "mid" && !quietType && !tappedIdea
  const highlightId = showRail
    ? visibleEvents.some((e) => e.id === railFocusId)
      ? railFocusId
      : (visibleEvents[0]?.id ?? null)
    : null

  const toggleType = (type: EventType) => {
    haptic("selection")
    setRailFocusId(null)
    setTappedIdeaId(null)
    setTypeFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }
  const clearTypes = () => {
    haptic("selection")
    setRailFocusId(null)
    setTappedIdeaId(null)
    setTypeFilters(new Set())
  }
  const changeTimeFilter = (next: TimeFilter) => {
    haptic("selection")
    setRailFocusId(null)
    setTimeFilter(next)
  }
  const lightFlare = (prefill?: ComposerPrefill) => {
    haptic("medium")
    openDrawer(prefill)
  }

  // ---- Routes API: compute route + ETA when activeRoute changes ----
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const routeDestination = useMemo<GeoCoords | null>(
    () => (activeRoute ? eventCoords(activeRoute) : null),
    [activeRoute]
  )
  const routeOrigin = geo.coords ?? cameraCenter
  const onRouteReadyRef = useRef(onRouteReady)

  useEffect(() => {
    onRouteReadyRef.current = onRouteReady
  }, [onRouteReady])

  useEffect(() => {
    if (!activeRoute || !routeDestination || !routeOrigin) {
      queueMicrotask(() => {
        setRouteResult(null)
        setRouteError(null)
      })
      return
    }
    if (!apiKey) {
      // Without an API key we can't call Routes API; degrade to a straight
      // line and skip the ETA. Map is in static-fallback mode anyway.
      queueMicrotask(() =>
        setRouteResult({
          path: [routeOrigin, routeDestination],
          durationSeconds: 0,
          distanceMeters: 0,
          etaLabel: "",
          distanceLabel: "",
        })
      )
      return
    }
    const ac = new AbortController()
    computeRoute(routeOrigin, routeDestination, "WALK", ac.signal)
      .then((result) => {
        setRouteResult(result)
        setRouteError(null)
        if (result.etaLabel)
          onRouteReadyRef.current?.(activeRoute, result.etaLabel)
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        // Fall back to a straight line so the user still has *some* visual
        const fallback: RouteResult = {
          path: [routeOrigin, routeDestination],
          durationSeconds: 0,
          distanceMeters: 0,
          etaLabel: "",
          distanceLabel: "",
        }
        setRouteResult(fallback)
        setRouteError(err instanceof Error ? err.message : "Route unavailable")
      })
    return () => ac.abort()
  }, [activeRoute, routeDestination, routeOrigin, apiKey])

  // Pull-to-refresh on the full list. Fires only when the list is scrolled
  // to the top (scrollTop === 0) and the user drags down more than 56px.
  // The list scrolls natively and nothing else claims the drag, so the two
  // don't compete.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullStartY = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const handleListTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) === 0) {
      pullStartY.current = e.touches[0].clientY
    }
  }
  const handleListTouchEnd = (e: React.TouchEvent) => {
    if (pullStartY.current === null) return
    const dist = e.changedTouches[0].clientY - pullStartY.current
    pullStartY.current = null
    if (dist < 56) return
    setIsRefreshing(true)
    haptic("light")
    map.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const snap = (next: DockState) => {
    if (next === dock) return
    setDock(next)
    haptic("selection")
  }

  // A vertical swipe on the dock steps peek → mid → full (up) or mid → peek
  // (down). Only a shortcut: the buttons do all the work, so there's no drag
  // physics to get wrong. Horizontal swipes belong to the rail and chips.
  const dockSwipe = useRef<{ x: number; y: number } | null>(null)
  const handleDockTouchStart = (e: React.TouchEvent) => {
    dockSwipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleDockTouchEnd = (e: React.TouchEvent) => {
    const start = dockSwipe.current
    dockSwipe.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return
    if (dy < 0) snap(dock === "peek" ? "mid" : "full")
    else if (dock === "mid") snap("peek")
  }

  const railRef = useRef<HTMLDivElement | null>(null)
  const syncRailFocus = () => {
    const rail = railRef.current
    if (!rail) return
    const centre = rail.scrollLeft + rail.clientWidth / 2
    let best: string | null = null
    let bestDist = Infinity
    for (const child of Array.from(rail.children) as HTMLElement[]) {
      const id = child.dataset.railId
      if (!id) continue
      const d = Math.abs(child.offsetLeft + child.offsetWidth / 2 - centre)
      if (d < bestDist) {
        bestDist = d
        best = id
      }
    }
    // The CTA card at the end of the rail has no pin to highlight.
    setRailFocusId(best === RAIL_CTA_ID ? null : best)
  }

  const singleType =
    typeFilters.size === 1
      ? EVENT_TYPES.find((t) => typeFilters.has(t.value))
      : undefined
  const ctaLabel = singleType
    ? `light a ${singleType.label} flare`
    : "light a flare"
  const CtaIcon = singleType?.icon ?? Flame

  const statusLabel = !cameraCenter
    ? locationStatusLabel(geo.status)
    : map.loading
      ? mapWakingUp
        ? "waking up the server…"
        : "loading..."
      : map.refreshing
        ? "updating..."
        : `${activeCount} active`

  const dockHidden = dock === "full" || composeOpen
  const listOpen = dock === "full" && !composeOpen

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onPointerDown={handleMapPointerDown}
      onPointerUp={handleMapPointerUp}
      onPointerCancel={handleMapPointerUp}
      onPointerLeave={handleMapPointerUp}
    >
      {!cameraCenter ? (
        <MapCameraPlaceholder
          status={geo.status}
          errorMessage={geo.errorMessage}
          onRetry={geo.request}
        />
      ) : apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMapContent
            events={mapEvents}
            onEventSelect={onEventSelect}
            previewEvent={previewEvent}
            setPreviewEvent={setPreviewEvent}
            routeResult={routeResult}
            routeDestination={routeDestination}
            joinedIds={joinedIds}
            cameraCenter={cameraCenter}
            currentLocation={geo.coords}
            recenterTick={recenterTick}
            highlightId={highlightId}
            ideas={ideaPins}
            selectedIdeaId={selectedIdeaId}
            onIdeaSelect={selectIdeaPin}
          />
        </APIProvider>
      ) : (
        <StaticMapFallback
          events={mapEvents}
          onEventSelect={onEventSelect}
          joinedIds={joinedIds}
          user={cameraCenter}
          highlightId={highlightId}
          ideas={ideaPins}
          selectedIdeaId={selectedIdeaId}
          onIdeaSelect={selectIdeaPin}
        />
      )}

      {/* Geolocation + route error banners — top-16 clears the floating
          header chips. With the list page open the banner moves into the
          list's header instead of floating over it. */}
      {!listOpen && (
        <GeolocationBanner
          status={geo.status}
          showingCachedLocation={isUsingCachedLocation}
          onRetry={geo.request}
        />
      )}

      {routeError && (
        <div className="absolute top-28 right-3 z-30 flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs shadow">
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span>Route unavailable</span>
        </div>
      )}

      {/* Dock: sits on the nav. Hidden at full (the list page takes over)
          and while composing: two bottom surfaces on screen at once was the
          most confusing symptom of #94. */}
      <div
        ref={dockRef}
        data-map-dock
        aria-hidden={dockHidden}
        onTouchStart={handleDockTouchStart}
        onTouchEnd={handleDockTouchEnd}
        style={{ bottom: NAV_RESERVED_CSS }}
        className={`pointer-events-none fixed inset-x-0 z-20 flex flex-col gap-2 pb-2 transition-opacity duration-200 ${
          dockHidden ? "invisible opacity-0" : ""
        }`}
      >
        {/* Map controls. The plain FAB only shows at peek: from mid up the
            nav's flare button is right below and does the same. Recenter
            is only meaningful on a real Google map. */}
        {(dock === "peek" || (hasInteractiveMap && dock === "mid")) && (
          <div className="flex flex-col items-end gap-3 px-4">
            {hasInteractiveMap && (
              <button
                type="button"
                onClick={() => {
                  haptic("light")
                  if (!hasCurrentLocation) geo.request()
                  else setRecenterTick((n) => n + 1)
                }}
                aria-label="Recenter on my location"
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md active:scale-95"
              >
                <LocateFixed className="h-5 w-5" />
              </button>
            )}
            {dock === "peek" && (
              <button
                type="button"
                onClick={() => lightFlare()}
                aria-label="Light a flare"
                className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:scale-95"
              >
                <Flame className="h-6 w-6" />
              </button>
            )}
          </div>
        )}

        {tappedIdea && tappedIdeaType ? (
          <QuietFlareCard
            type={tappedIdeaType}
            idea={tappedIdea}
            center={cameraCenter}
            onLight={(prefill) => lightFlare(prefill)}
            onDismiss={() => setTappedIdeaId(null)}
            onHideIdeas={hideIdeas}
          />
        ) : quietTypeInfo ? (
          <QuietFlareCard
            type={quietTypeInfo}
            idea={idea}
            center={cameraCenter}
            onLight={(prefill) => lightFlare(prefill)}
            onHideIdeas={hideIdeas}
          />
        ) : showRail ? (
          <div
            key={`${timeFilter}:${[...typeFilters].join(",")}`}
            ref={railRef}
            onScroll={syncRailFocus}
            aria-label="flares near you"
            role="region"
            className="scrollbar-none pointer-events-auto flex touch-pan-x snap-x snap-mandatory scroll-px-3 items-end gap-2 overflow-x-auto px-3 py-2"
          >
            {!cameraCenter ? (
              <RailPanel>
                <LocationSheetState
                  status={geo.status}
                  errorMessage={geo.errorMessage}
                  onRetry={geo.request}
                />
              </RailPanel>
            ) : mapFailedEmpty ? (
              <RailPanel>
                <ErrorPanel message={map.error!} onRetry={map.refresh} />
              </RailPanel>
            ) : visibleEvents.length === 0 && map.loading ? (
              <RailPanel padded>
                <p className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  {mapWakingUp ? "waking up the server…" : "loading flares..."}
                </p>
              </RailPanel>
            ) : visibleEvents.length === 0 ? (
              <RailPanel padded>
                <EmptyState
                  compact
                  radiusKm={searchRadiusKm}
                  onWiden={
                    searchRadiusKm < WIDE_RADIUS_KM
                      ? () => setSearchRadiusKm(WIDE_RADIUS_KM)
                      : null
                  }
                  onSeeCalendar={onSeeCalendar}
                  onFindConnections={() => router.push("/circles?tab=people")}
                />
              </RailPanel>
            ) : (
              <>
                {visibleEvents.map((event) => (
                  <RailCard
                    key={event.id}
                    event={event}
                    joined={isJoined(event, joinedIds)}
                    user={geo.coords}
                    onClick={() => onEventSelect(event)}
                  />
                ))}
                <div
                  data-rail-id={RAIL_CTA_ID}
                  className="flex w-[78%] max-w-80 shrink-0 snap-center flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-(--shadow-card)"
                >
                  <div>
                    <p className="text-base font-semibold">
                      {singleType
                        ? `up for ${singleType.label}?`
                        : "nothing you fancy?"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      start one and your circles will see it
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => lightFlare()}
                    className="flex h-9 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground active:scale-[0.98]"
                  >
                    <CtaIcon className="h-4 w-4" />
                    {ctaLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Filter bar */}
        <div className="pointer-events-auto mx-3 space-y-2 rounded-2xl border border-border/60 bg-background/90 p-2 shadow-(--shadow-card) backdrop-blur-md">
          <div className="flex items-center gap-2">
            <TimeTabs
              value={timeFilter}
              onChange={changeTimeFilter}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => snap(dock === "mid" ? "peek" : "mid")}
              aria-label={dock === "mid" ? "hide cards" : "show cards"}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium active:scale-[0.97]"
            >
              {dock === "mid" ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  hide
                </>
              ) : (
                <>
                  {map.loading ? (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  ) : (
                    <span>{visibleEvents.length}</span>
                  )}
                  nearby
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => snap("full")}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-2.5 text-xs font-medium text-primary active:scale-[0.97]"
            >
              <List className="h-3.5 w-3.5" />
              list
            </button>
          </div>
          <TypeChips
            active={typeFilters}
            onToggle={toggleType}
            onClear={clearTypes}
            className="mx-0 px-0"
          />
        </div>
      </div>

      {/* Full: a plain list page between the header chips and the nav. It
          scrolls natively; nothing to drag. */}
      <div
        role="region"
        aria-label="flare list"
        aria-hidden={!listOpen}
        data-map-list
        style={{
          top: TOP_RESERVED_CSS,
          bottom: NAV_RESERVED_CSS,
          transitionTimingFunction: SHEET_EASE,
        }}
        className={`fixed inset-x-0 z-20 flex flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) transition-[translate,visibility] duration-500 ${
          listOpen
            ? "translate-y-0"
            : "pointer-events-none invisible translate-y-[calc(100%+8rem)]"
        }`}
      >
        <div className="shrink-0 space-y-2 px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">flares near you</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={() => snap("mid")}
                className="flex h-8 items-center gap-1 rounded-full bg-card px-3 text-xs font-medium text-primary active:scale-[0.97]"
              >
                <MapIcon className="h-3.5 w-3.5" />
                map
              </button>
            </div>
          </div>
          {listOpen && (
            <GeolocationBanner
              inline
              status={geo.status}
              showingCachedLocation={isUsingCachedLocation}
              onRetry={geo.request}
            />
          )}
          <TimeTabs value={timeFilter} onChange={changeTimeFilter} />
          <TypeChips
            active={typeFilters}
            onToggle={toggleType}
            onClear={clearTypes}
          />
        </div>

        <div
          ref={scrollRef}
          onTouchStart={handleListTouchStart}
          onTouchEnd={handleListTouchEnd}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-6"
        >
          {/* Pull-to-refresh indicator */}
          {isRefreshing && (
            <div className="mb-2 flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              refreshing…
            </div>
          )}

          {!cameraCenter ? (
            <LocationSheetState
              status={geo.status}
              errorMessage={geo.errorMessage}
              onRetry={geo.request}
            />
          ) : mapFailedEmpty ? (
            <ErrorPanel message={map.error!} onRetry={map.refresh} />
          ) : visibleEvents.length === 0 && !endedVisible && !map.loading ? (
            <EmptyState
              compact={false}
              radiusKm={searchRadiusKm}
              onWiden={
                searchRadiusKm < WIDE_RADIUS_KM
                  ? () => setSearchRadiusKm(WIDE_RADIUS_KM)
                  : null
              }
              onSeeCalendar={onSeeCalendar}
              onFindConnections={() => router.push("/circles?tab=people")}
            />
          ) : (
            <div className="space-y-2">
              {map.refreshing && mapEvents.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  loading nearby events...
                </div>
              )}
              {map.error && mapEvents.length > 0 && (
                <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                  couldn&apos;t refresh nearby flares
                </div>
              )}
              {visibleEvents.map((event) => (
                <FlareCard
                  key={event.id}
                  event={event}
                  joined={isJoined(event, joinedIds)}
                  user={geo.coords}
                  status={isLive(event) ? "live" : "upcoming"}
                  onClick={() => onEventSelect(event)}
                  onSwipeJoin={() => {
                    haptic("success")
                    onEventSelect(event)
                  }}
                />
              ))}
              {endedVisible && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      haptic("selection")
                      setShowEnded((s) => !s)
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span>
                      {showEnded ? "hide" : "show"} {groupedEvents.ended.length}{" "}
                      ended
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showEnded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {showEnded &&
                    groupedEvents.ended.map((event) => (
                      <FlareCard
                        key={event.id}
                        event={event}
                        joined={isJoined(event, joinedIds)}
                        user={geo.coords}
                        status="ended"
                        onClick={() => onEventSelect(event)}
                      />
                    ))}
                </>
              )}
              {visibleEvents.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => lightFlare()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground active:scale-[0.98]"
                  >
                    <CtaIcon className="h-4 w-4" />
                    {ctaLabel}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MapCameraPlaceholder({
  status,
  errorMessage,
  onRetry,
}: {
  status: GeoStatus
  errorMessage: string | null
  onRetry: () => void
}) {
  const blocked =
    status === "denied" || status === "unavailable" || status === "error"
  const title = blocked ? "location needed" : "finding your location"
  const message = blocked
    ? (errorMessage ??
      "Turn on location access to show nearby flares in your area.")
    : "Setting up the map around you."

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-muted">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-6 flex max-w-xs flex-col items-center text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-sm">
          {blocked ? (
            <MapPin className="h-5 w-5 text-accent" />
          ) : (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          )}
        </div>
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {blocked && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            try again
          </button>
        )}
      </div>
    </div>
  )
}

function GeolocationBanner({
  status,
  showingCachedLocation,
  onRetry,
  inline = false,
}: {
  status: GeoStatus
  showingCachedLocation: boolean
  /** In the list page's header rather than floating under the header chips. */
  inline?: boolean
  onRetry: () => void
}) {
  if (!showingCachedLocation) return null
  if (status === "granted" || status === "idle" || status === "requesting")
    return null
  const msg =
    status === "denied"
      ? "showing last known area - enable location for nearby flares"
      : "couldn't update your location - showing last known area"
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs ${
        inline
          ? "bg-background"
          : "absolute top-16 right-3 left-3 z-30 bg-background/95 shadow-md"
      }`}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span className="flex-1">{msg}</span>
      <button onClick={onRetry} className="shrink-0 font-medium text-accent">
        retry
      </button>
    </div>
  )
}

function locationStatusLabel(status: GeoStatus): string {
  if (status === "denied") return "location off"
  if (status === "unavailable" || status === "error") return "location issue"
  return "locating..."
}

function LocationSheetState({
  status,
  errorMessage,
  onRetry,
}: {
  status: GeoStatus
  errorMessage: string | null
  onRetry: () => void
}) {
  const blocked =
    status === "denied" || status === "unavailable" || status === "error"

  if (!blocked) {
    return (
      <div className="rounded-xl border border-border p-4 text-center">
        <span className="mx-auto mb-3 block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm font-medium">finding your location</p>
        <p className="mt-1 text-xs text-muted-foreground">
          nearby flares will load once the map knows where to start
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border p-4 text-center">
      <MapPin className="mx-auto mb-2 h-5 w-5 text-accent" />
      <p className="text-sm font-medium">location needed</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {errorMessage ??
          "Enable location access to show nearby flares around you."}
      </p>
      <button
        onClick={onRetry}
        className="mt-3 text-sm font-medium text-accent"
      >
        try again
      </button>
    </div>
  )
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  // Sized to fit the peek sheet (see EmptyState) so it doesn't scroll-clip.
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <AlertCircle className="h-4 w-4 text-destructive" />
        couldn&apos;t load flares
      </p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{message}</p>
      <button onClick={onRetry} className="text-sm font-medium text-accent">
        try again
      </button>
    </div>
  )
}

function EmptyState({
  compact,
  radiusKm,
  onWiden,
  onSeeCalendar,
  onFindConnections,
}: {
  compact: boolean
  radiusKm: number
  onWiden: (() => void) | null
  onSeeCalendar?: () => void
  onFindConnections: () => void
}) {
  // At peek the sheet leaves ~90px under the header. The full card doesn't
  // fit there and would scroll-clip (#113), so show one line, the primary
  // action, and the secondary options as text links. The empty map above
  // already says "nothing here".
  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          no flares within {radiusKm} km
          <span className="font-normal text-muted-foreground">
            {" "}
            · quiet right now
          </span>
        </p>
        <button
          onClick={onFindConnections}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground hover:opacity-90 active:scale-[0.97]"
        >
          <Flame className="h-4 w-4" /> connect with your friends
        </button>
        {(onWiden || onSeeCalendar) && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {onWiden && (
              <button
                onClick={onWiden}
                className="font-medium hover:text-foreground"
              >
                search {WIDE_RADIUS_KM} km
              </button>
            )}
            {onWiden && onSeeCalendar && <span aria-hidden>·</span>}
            {onSeeCalendar && (
              <button
                onClick={onSeeCalendar}
                className="font-medium hover:text-foreground"
              >
                see what&apos;s planned
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-center">
      <p className="mb-1 text-sm font-medium">no flares within {radiusKm} km</p>
      <p className="mb-4 text-xs text-muted-foreground">
        quiet around here right now — try one of these
      </p>
      <div className="flex flex-col gap-2">
        {onWiden && (
          <button
            onClick={onWiden}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary active:bg-muted"
          >
            <Expand className="h-4 w-4" /> search within {WIDE_RADIUS_KM} km
          </button>
        )}
        {onSeeCalendar && (
          <button
            onClick={onSeeCalendar}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary active:bg-muted"
          >
            <CalendarIcon className="h-4 w-4" /> see what&apos;s planned
          </button>
        )}
        <button
          onClick={onFindConnections}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 active:scale-[0.97]"
        >
          <Flame className="h-4 w-4" /> connect with your friends
        </button>
      </div>
    </div>
  )
}

function endingInLabel(event: EventItem, now: number = Date.now()): string {
  const end = new Date(event.endAt).getTime()
  const mins = Math.max(0, Math.round((end - now) / 60_000))
  if (mins < 60) return `ending in ${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `ending in ${hours}h` : `ending in ${hours}h ${rem}m`
}

/** "by sarah · 0.4 km · ending in 42 min", shared by the list and rail cards. */
function useFlareMeta(
  event: EventItem,
  user: GeoCoords | null,
  status: "live" | "upcoming" | "ended"
): string {
  const { user: authUser } = useAuth()
  const dist = distanceFromUser(event, user)
  const hostFirst =
    event.host.id === authUser?.id
      ? "you"
      : event.host.name.trim().split(/\s+/)[0]
  const timeLabel =
    status === "live"
      ? endingInLabel(event)
      : status === "ended"
        ? "ended"
        : formatRelativeStatus(event)
  return [`by ${hostFirst}`, dist?.label, timeLabel].filter(Boolean).join(" · ")
}

function FlareCard({
  event,
  joined,
  user,
  status,
  onClick,
  onSwipeJoin,
}: {
  event: EventItem
  joined: boolean
  user: GeoCoords | null
  status: "live" | "upcoming" | "ended"
  onClick: () => void
  onSwipeJoin?: () => void
}) {
  const isEnded = status === "ended"
  const isLiveStatus = status === "live"
  const swipeStartX = useRef<number | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const SWIPE_THRESHOLD = 80
  const swipeEnabled = !joined && !isEnded

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeEnabled) return
    swipeStartX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (swipeStartX.current === null) return
    const dx = e.clientX - swipeStartX.current
    setSwipeX(Math.max(0, Math.min(dx, SWIPE_THRESHOLD + 20)))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeStartX.current === null) return
    const dx = e.clientX - swipeStartX.current
    swipeStartX.current = null
    setSwipeX(0)
    if (dx >= SWIPE_THRESHOLD && swipeEnabled) {
      onSwipeJoin?.()
    } else {
      onClick()
    }
  }

  const metaText = useFlareMeta(event, user, status)

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe-reveal "I'm in" hint — hidden for ended/joined cards */}
      {swipeEnabled && (
        <div className="absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-xl bg-accent">
          <span className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-accent-foreground">
            <Check className="h-4 w-4" />
            I&apos;m in
          </span>
        </div>
      )}

      <Card
        className={`relative cursor-pointer flex-row items-center gap-3.5 rounded-xl border p-3 transition-colors hover:bg-muted/50 active:bg-muted ${
          isLiveStatus ? "border-l-[3px] border-l-accent" : ""
        } ${isEnded ? "border-border bg-muted/30" : "border-border"}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? "transform 0.2s ease-out" : "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={swipeX > 4 ? undefined : onClick}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isEnded
              ? "bg-muted text-muted-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          <FlareTypeIcon event={event} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={`truncate font-medium ${
                isEnded ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {event.title.split("·", 2)[0]}
            </p>
            {joined && !isEnded && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                <Check className="h-2.5 w-2.5" /> going
              </span>
            )}
          </div>
          <p
            className={`truncate text-xs ${
              isEnded ? "text-muted-foreground/70" : "text-muted-foreground"
            }`}
          >
            {metaText}
          </p>
        </div>
        <ChevronRight
          className={`h-5 w-5 shrink-0 ${
            isEnded ? "text-muted-foreground/50" : "text-muted-foreground"
          }`}
        />
      </Card>
    </div>
  )
}

function FilterChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon?: React.ElementType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.97] ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  )
}

type TimeFilter = "live" | "upcoming" | "all"

// data-rail-id of the CTA card at the end of the rail (it has no pin).
const RAIL_CTA_ID = "cta"

function TimeTabs({
  value,
  onChange,
  className,
}: {
  value: TimeFilter
  onChange: (next: TimeFilter) => void
  className?: string
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as TimeFilter)}
      className={className}
    >
      <TabsList className="h-8 w-full">
        <TabsTrigger value="live" className="text-xs">
          live
        </TabsTrigger>
        <TabsTrigger value="upcoming" className="text-xs">
          soon
        </TabsTrigger>
        <TabsTrigger value="all" className="text-xs">
          all
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function TypeChips({
  active,
  onToggle,
  onClear,
  className = "",
}: {
  active: ReadonlySet<EventType>
  onToggle: (type: EventType) => void
  onClear: () => void
  className?: string
}) {
  // touch-pan-x: the row scrolls sideways; vertical swipes stay with the dock.
  return (
    <div
      className={`scrollbar-none -mx-4 flex touch-pan-x items-center gap-2 overflow-x-auto px-4 pb-1 ${className}`}
    >
      {EVENT_TYPES.map((t) => (
        <FilterChip
          key={t.value}
          label={t.label}
          icon={t.icon}
          active={active.has(t.value)}
          onClick={() => onToggle(t.value)}
        />
      ))}
      {active.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          clear
        </button>
      )}
    </div>
  )
}

/** A full-width floating panel in the rail for loading, empty and error states. */
function RailPanel({
  padded = false,
  children,
}: {
  padded?: boolean
  children: React.ReactNode
}) {
  // Unpadded panels wrap a component that brings its own border and padding.
  return (
    <div
      className={`w-full shrink-0 rounded-xl bg-background shadow-(--shadow-card) ${
        padded ? "border border-border p-3" : ""
      }`}
    >
      {children}
    </div>
  )
}

/**
 * The quiet-state card: one type chip on, nothing of that type live. With an
 * idea (#243) it names a real nearby place or moment and opens the composer
 * filled with it; without one it is the generic type card, which opens the
 * composer with just the category. Sized like a rail card, and the muted
 * "idea" tag keeps it from reading as a real flare.
 */
export function QuietFlareCard({
  type,
  idea,
  center,
  onLight,
  onDismiss,
  onHideIdeas,
}: {
  type: (typeof EVENT_TYPES)[number]
  idea: FlareIdea | null
  center: GeoCoords | null
  onLight: (prefill: ComposerPrefill) => void
  /** Only for a card opened from an idea pin: closes it back to the rail. The
   * quiet-state card is state, not a choice, so it has no close. */
  onDismiss?: () => void
  /** One tap to switch idea spots off (#245). Only offered on an idea card. */
  onHideIdeas?: () => void
}) {
  const Icon = type.icon
  const distance =
    idea && center ? formatDistance(haversineMeters(center, idea.place)) : null
  return (
    <div
      data-quiet-card={idea ? "idea" : "generic"}
      className="pointer-events-auto mx-3 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-(--shadow-card)"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={
              idea
                ? "line-clamp-2 font-medium text-foreground"
                : "text-base font-semibold"
            }
          >
            {idea ? idea.title : `up for ${type.label}?`}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {idea
              ? [idea.place.name, distance].filter(Boolean).join(" · ")
              : "start one and your circles will see it"}
          </p>
        </div>
        {idea && (
          <span className="shrink-0 self-start rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            idea
          </span>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="close idea"
            className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onLight(idea ? ideaPrefill(idea) : { category: type.value })
          }
          className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground active:scale-[0.98]"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {idea ? "light a flare" : `light a ${type.label} flare`}
          </span>
        </button>
        {idea && onHideIdeas && (
          <button
            type="button"
            onClick={onHideIdeas}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-3 text-sm font-medium text-muted-foreground active:scale-[0.98]"
          >
            <EyeOff className="h-4 w-4" />
            hide ideas
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A flare in the mid-state rail. Content height (the rail aligns its items to
 * the end, so a taller neighbour doesn't stretch it), and no swipe-to-join:
 * horizontal swipes scroll the rail.
 */
function RailCard({
  event,
  joined,
  user,
  onClick,
}: {
  event: EventItem
  joined: boolean
  user: GeoCoords | null
  onClick: () => void
}) {
  const live = isLive(event)
  const metaText = useFlareMeta(event, user, live ? "live" : "upcoming")
  return (
    <button
      type="button"
      data-rail-id={event.id}
      onClick={onClick}
      className={`flex w-[78%] max-w-80 shrink-0 snap-center flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-left shadow-(--shadow-card) active:scale-[0.99] ${
        live ? "border-l-[3px] border-l-accent" : ""
      }`}
    >
      <div className="flex w-full items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <FlareTypeIcon event={event} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            {event.title.split("·", 2)[0]}
          </p>
          <p className="truncate text-xs text-muted-foreground">{metaText}</p>
        </div>
      </div>
      <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
        {event.going > 0 ? (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {event.going} going
          </span>
        ) : (
          <span />
        )}
        {joined ? (
          <span className="flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 font-medium text-accent">
            <Check className="h-2.5 w-2.5" /> going
          </span>
        ) : (
          <span className="font-medium text-foreground">
            {live ? "live now" : "soon"}
          </span>
        )}
      </div>
    </button>
  )
}

function FlareTypeIcon({ event }: { event: EventItem }) {
  const match = EVENT_TYPES.find((t) => t.value === event.type)
  if (!match) return <span className="text-sm">{event.host.avatar}</span>
  const Icon = match.icon
  return <Icon className="h-5 w-5" />
}
