"use client"

// #389 (behind `browseBeforeSignup`): the home map for a signed-out visitor.
//
// It shows what Sponti is without an account: the curated idea spots and the
// open-to-all flares from the public map endpoint (#425), as pins only. It
// loads nothing else. No session, no events list, no circles, and no
// position request: until the location ask (#408) lands, it centres on
// berlin, where the idea spots are.
//
// Every way of doing something here (a pin, an idea's "light a flare", the
// FAB) is handed to the parent, which asks the visitor to sign up.

import { useEffect, useMemo, useState } from "react"
import {
  APIProvider,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APILoadingStatus,
  Map,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps"
import { useTheme } from "next-themes"
import { FlameIcon, MapPinIcon } from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { FlarePin, VisibilityLegend } from "@/components/map-flare-pin"
import {
  FLARE_PIN_SLOTS,
  IDEA_PIN_SLOTS,
  IdeaPinMark,
  QuietFlareCard,
} from "@/components/map-view"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isLive } from "@/lib/api/events"
import type { PublicMapPin } from "@/lib/api/public-map"
import { getIdeaPins, type FlareIdea } from "@/lib/flare-ideas"
import type { GeoCoords } from "@/lib/geolocation"
import { haptic } from "@/lib/haptics"
import { useIdeasHidden } from "@/lib/idea-preferences"
import { usePublicMapPins } from "@/lib/use-public-map-pins"
import { EVENT_TYPES } from "@/types/utils"

/** Where the signed-out map opens: kreuzberg, among the berlin idea spots.
 * The location ask (#408) will replace it with the visitor's position or a
 * picked area. */
export const SIGNED_OUT_CENTER: GeoCoords = { lat: 52.5, lng: 13.42 }
export const SIGNED_OUT_AREA_LABEL = "berlin"
const SIGNED_OUT_ZOOM = 13

type TimeFilter = "live" | "upcoming" | "all"

const NO_IDEA_CATEGORIES = new Set<never>()

function pinLabel(pin: PublicMapPin, now: number): string {
  const type = EVENT_TYPES.find((t) => t.value === pin.type)?.label ?? pin.type
  return `${type} flare, open to all, ${isLive(pin, now) ? "live" : "soon"}`
}

export function SignedOutMap({
  center = SIGNED_OUT_CENTER,
  areaLabel = SIGNED_OUT_AREA_LABEL,
  onPin,
  onLightIdea,
  onLight,
}: {
  center?: GeoCoords
  areaLabel?: string
  /** An open-to-all pin was tapped. */
  onPin: (pin: PublicMapPin) => void
  /** An idea card's "light a flare". */
  onLightIdea: (idea: FlareIdea) => void
  /** The FAB. */
  onLight: () => void
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [nowMs, setNowMs] = useState(0)
  useEffect(() => {
    const updateNow = () => setNowMs(Date.now())
    updateNow()
    const id = window.setInterval(updateNow, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const { pins, loading, failed } = usePublicMapPins(center)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all")
  // A pin's chip depends on the clock, so pins wait for it, as on the
  // signed-in map.
  const visiblePins = useMemo(() => {
    if (nowMs <= 0) return []
    return pins.filter((pin) => {
      const end = new Date(pin.endAt).getTime()
      if (end < nowMs) return false
      const live = isLive(pin, nowMs)
      if (timeFilter === "live") return live
      if (timeFilter === "upcoming") return !live
      return true
    })
  }, [pins, nowMs, timeFilter])

  // "hide ideas" (#245) is a device setting and holds here too. Unlike the
  // signed-in map, ideas don't wait for the flares: a cold backend can take a
  // minute, and the ideas are most of what a first visit shows.
  const ideasHidden = useIdeasHidden()
  const ideas = useMemo(
    () =>
      !ideasHidden && nowMs > 0
        ? getIdeaPins({
            center,
            now: new Date(nowMs),
            categories: NO_IDEA_CATEGORIES,
            flarePositions: pins.map((p) => p.position),
          })
        : [],
    [ideasHidden, nowMs, center, pins]
  )
  const [tappedIdeaId, setTappedIdeaId] = useState<string | null>(null)
  const tappedIdea = ideas.find((i) => i.id === tappedIdeaId) ?? null
  const tappedIdeaType = tappedIdea
    ? EVENT_TYPES.find((t) => t.value === tappedIdea.category)
    : undefined

  const selectIdea = (idea: FlareIdea) => {
    haptic("selection")
    setTappedIdeaId((prev) => (prev === idea.id ? null : idea.id))
  }
  const selectPin = (pin: PublicMapPin) => {
    haptic("selection")
    setTappedIdeaId(null)
    onPin(pin)
  }

  const count = visiblePins.length
  const title =
    count > 0
      ? `${count} open ${count === 1 ? "flare" : "flares"} in ${areaLabel}`
      : "quiet around here"
  const hint = loading
    ? "loading flares…"
    : failed
      ? "couldn't load flares right now."
      : count > 0
        ? "open to all, live now and later today. tap one to see more."
        : ideas.length > 0
          ? "no flares yet. the dashed spots are ideas, tap one."
          : "no flares yet."

  const canvasProps = {
    center,
    now: nowMs,
    pins: visiblePins,
    ideas,
    selectedIdeaId: tappedIdea?.id ?? null,
    onPin: selectPin,
    onIdea: selectIdea,
  }

  return (
    <div className="absolute inset-0 overflow-hidden" data-signed-out-map>
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <SignedOutGoogleMap {...canvasProps} />
        </APIProvider>
      ) : (
        <SignedOutStaticMap {...canvasProps} />
      )}

      {/* Under the floating header chips: the area, and the pin legend while
          any flare pin is on the map (#315). */}
      <div className="pointer-events-none absolute inset-x-3 top-16 z-30 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow">
          <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {areaLabel}
        </span>
        {visiblePins.length > 0 && <VisibilityLegend />}
      </div>

      {/* The dock sits on the nav, like the signed-in map's. */}
      <div
        data-map-dock
        style={{ bottom: "var(--sponti-nav-h, 64px)" }}
        className="pointer-events-none fixed inset-x-0 z-20 flex flex-col gap-2 pb-2"
      >
        <div className="flex justify-end px-4">
          <button
            type="button"
            onClick={() => {
              haptic("medium")
              onLight()
            }}
            aria-label="Light a flare"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:scale-95"
          >
            <FlameIcon className="h-6 w-6" />
          </button>
        </div>

        {tappedIdea && tappedIdeaType ? (
          <QuietFlareCard
            type={tappedIdeaType}
            idea={tappedIdea}
            center={center}
            onLight={() => {
              haptic("medium")
              onLightIdea(tappedIdea)
            }}
            onDismiss={() => setTappedIdeaId(null)}
          />
        ) : (
          <div className="pointer-events-auto mx-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-(--shadow-card) backdrop-blur-md">
            <p className="text-base font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            <Tabs
              value={timeFilter}
              onValueChange={(next) => {
                haptic("selection")
                setTimeFilter(next as TimeFilter)
              }}
            >
              <TabsList className="mt-3 h-8 w-full">
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
          </div>
        )}

        {/* #457: the Impressum is one tap away from the map. */}
        <LegalLinks className="pointer-events-auto mx-auto -my-1.5 w-fit rounded-full bg-background/80 px-1 backdrop-blur-md" />
      </div>
    </div>
  )
}

type CanvasProps = {
  center: GeoCoords
  now: number
  pins: PublicMapPin[]
  ideas: FlareIdea[]
  selectedIdeaId: string | null
  onPin: (pin: PublicMapPin) => void
  onIdea: (idea: FlareIdea) => void
}

/** No maps key (local dev, e2e) or the SDK failed: a flat backdrop with the
 * pins in fixed slots, like the signed-in map's fallback. */
function SignedOutStaticMap({
  now,
  pins,
  ideas,
  selectedIdeaId,
  onPin,
  onIdea,
}: CanvasProps) {
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
      {ideas.map((idea, i) => (
        <button
          key={idea.id}
          type="button"
          data-idea-pin={idea.id}
          aria-label={`idea: ${idea.title}`}
          onClick={() => onIdea(idea)}
          style={IDEA_PIN_SLOTS[i % IDEA_PIN_SLOTS.length]}
          className="absolute z-[1]"
        >
          <IdeaPinMark idea={idea} selected={selectedIdeaId === idea.id} />
        </button>
      ))}
      {pins.slice(0, FLARE_PIN_SLOTS.length).map((pin, i) => (
        <button
          key={pin.id}
          type="button"
          aria-label={pinLabel(pin, now)}
          onClick={() => onPin(pin)}
          style={FLARE_PIN_SLOTS[i]}
          className="absolute flex flex-col items-center"
        >
          <FlarePin event={pin} own={false} joined={false} now={now} />
        </button>
      ))}
    </div>
  )
}

function SignedOutGoogleMap(props: CanvasProps) {
  const { center, now, pins, ideas, selectedIdeaId, onPin, onIdea } = props
  const status = useApiLoadingStatus()
  const { resolvedTheme } = useTheme()

  if (status === APILoadingStatus.FAILED) {
    return <SignedOutStaticMap {...props} />
  }

  return (
    <Map
      defaultCenter={center}
      defaultZoom={SIGNED_OUT_ZOOM}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      colorScheme={resolvedTheme === "dark" ? "DARK" : "LIGHT"}
      reuseMaps
      disableDefaultUI
      gestureHandling="greedy"
      className="h-full w-full"
    >
      {ideas.map((idea) => (
        <AdvancedMarker
          key={`idea:${idea.id}`}
          position={idea.place}
          anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
          title={idea.title}
          zIndex={selectedIdeaId === idea.id ? 400 : 0}
          onClick={() => onIdea(idea)}
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
      {pins.map((pin) => (
        <AdvancedMarker
          key={pin.id}
          position={pin.position}
          title={pinLabel(pin, now)}
          onClick={() => onPin(pin)}
        >
          <FlarePin event={pin} own={false} joined={false} now={now} />
        </AdvancedMarker>
      ))}
    </Map>
  )
}
