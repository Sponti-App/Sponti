"use client"

// #389 (behind `browseBeforeSignup`): the home map for a signed-out visitor.
//
// It shows what Sponti is without an account: the curated idea spots and the
// open-to-all flares from the public map endpoint (#425), as pins only. It
// loads nothing else. No session, no events list and no circles. It centres
// on berlin, where the idea spots are, unless the location ask (#408, behind
// `locationAsk`) gave it the visitor's position or a picked area.
//
// Every way of doing something here (a pin, an idea's "light a flare") is
// handed to the parent, which asks the visitor to sign up. Lighting a flare
// is the nav's flare button; the map has no FAB (#491).

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
import { LegalLinks } from "@/components/legal-links"
import { FlarePin } from "@/components/map-flare-pin"
import {
  FLARE_PIN_SLOTS,
  FloatingIdeaMarker,
  FloatingIdeaStaticPin,
  IDEA_PIN_SLOTS,
  IdeaPinMark,
  QuietFlareCard,
} from "@/components/map-view"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { featureFlags } from "@/lib/feature-flags"
import {
  pickQuietIdeas,
  QuietIdeaCards,
  ValuePropPanel,
} from "@/components/quiet-home"
import { isLive } from "@/lib/api/events"
import type { PublicMapPin } from "@/lib/api/public-map"
import { getIdeaPins, type FlareIdea } from "@/lib/flare-ideas"
import { type FloatingIdea, type Idea } from "@/lib/flare-ideas-anywhere"
import type { GeoCoords } from "@/lib/geolocation"
import { hasIdeaSpots } from "@/lib/location-ask"
import { BERLIN_START } from "@/lib/location-choice"
import { haptic } from "@/lib/haptics"
import { useIdeasHidden } from "@/lib/idea-preferences"
import { useFloatingIdeas } from "@/lib/use-floating-ideas"
import { usePublicMapPins } from "@/lib/use-public-map-pins"
import { EVENT_TYPES } from "@/types/utils"

/** Where the signed-out map opens: kreuzberg, among the berlin idea spots.
 * The location ask (#408) replaces it with the visitor's position or a picked
 * area. */
export const SIGNED_OUT_CENTER: GeoCoords = BERLIN_START
export const SIGNED_OUT_AREA_LABEL = "berlin"
const SIGNED_OUT_ZOOM = 13

type TimeFilter = "live" | "upcoming" | "all"

const NO_IDEA_CATEGORIES = new Set<never>()

// The map opens at zoom 13 (about 12 m per pixel), so the floating ideas'
// ring (#515) is wider than the signed-in map's 220 m to keep the pins a
// thumb apart.
const FLOATING_RADIUS_METERS = 800

function pinLabel(pin: PublicMapPin, now: number): string {
  const type = EVENT_TYPES.find((t) => t.value === pin.type)?.label ?? pin.type
  return `${type} flare, open to all, ${isLive(pin, now) ? "live" : "soon"}`
}

export function SignedOutMap({
  center = SIGNED_OUT_CENTER,
  areaLabel = SIGNED_OUT_AREA_LABEL,
  located = false,
  banner,
  dockHidden = false,
  onPin,
  onLightIdea,
}: {
  center?: GeoCoords
  areaLabel?: string
  /** The centre is the visitor's own position (#408). */
  located?: boolean
  /** A picked area's banner, under the header chips (#408). */
  banner?: React.ReactNode
  /** Hide the dock under the location ask (#408). */
  dockHidden?: boolean
  /** An open-to-all pin was tapped. */
  onPin: (pin: PublicMapPin) => void
  /** An idea card's "light a flare". */
  onLightIdea: (idea: Idea) => void
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
  // Floating ideas (#515) around the visitor's position, or the map's start
  // until there is one, clear of the open-to-all pins and the idea spots.
  const obstacles = useMemo(
    () => [...pins.map((p) => p.position), ...ideas.map((i) => i.place)],
    [pins, ideas]
  )
  const floatingIdeas = useFloatingIdeas({
    anchor: center,
    nowMs,
    categories: NO_IDEA_CATEGORIES,
    obstacles,
    radiusMeters: FLOATING_RADIUS_METERS,
  })
  const [tappedIdeaId, setTappedIdeaId] = useState<string | null>(null)
  const tappedIdea: Idea | null =
    ideas.find((i) => i.id === tappedIdeaId) ??
    floatingIdeas.find((i) => i.id === tappedIdeaId) ??
    null
  const tappedIdeaType = tappedIdea
    ? EVENT_TYPES.find((t) => t.value === tappedIdea.category)
    : undefined

  const selectIdea = (idea: Idea) => {
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
      ? `${count} open ${count === 1 ? "flare" : "flares"} ${located ? "near you" : `in ${areaLabel}`}`
      : "quiet around here"
  const hint = loading
    ? "loading flares…"
    : failed
      ? "couldn't load flares right now."
      : count > 0
        ? "open to all, live now and later today. tap one to see more."
        : ideas.length > 0
          ? "no flares yet. the dashed spots are ideas, tap one."
          : floatingIdeas.length > 0
            ? // #515: the spots are berlin-only, the floating ideas work anywhere.
              hasIdeaSpots(center)
              ? "no flares yet. the dashed ones are ideas, tap one."
              : "no flares yet, and no idea spots there yet. the dashed ones work anywhere, tap one."
            : hasIdeaSpots(center)
              ? "no flares yet."
              : "no flares yet, and no idea spots there yet: they're berlin-only for now."

  const canvasProps = {
    center,
    now: nowMs,
    pins: visiblePins,
    ideas,
    floatingIdeas,
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

      {/* Under the floating header chips: a picked area's banner (#408). The
          area itself is in the sheet's heading below (#496); no pin legend
          (#490). */}
      <div className="pointer-events-none absolute inset-x-3 top-16 z-30 flex flex-col items-end gap-2">
        {banner}
      </div>

      {/* The dock sits on the nav, like the signed-in map's. */}
      <div
        data-map-dock
        aria-hidden={dockHidden}
        style={{ bottom: "var(--sponti-nav-h, 64px)" }}
        className={`pointer-events-none fixed inset-x-0 z-20 flex flex-col gap-2 pb-2 ${
          dockHidden ? "invisible" : ""
        }`}
      >
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
        ) : featureFlags.quietHome &&
          !loading &&
          !failed &&
          count === 0 &&
          nowMs > 0 ? (
          // #522: what sponti is for, then ideas to light.
          <div data-quiet-home className="flex flex-col gap-2">
            <ValuePropPanel />
            <QuietIdeaCards
              ideas={pickQuietIdeas(ideas, floatingIdeas, center)}
              center={center}
              onLight={onLightIdea}
            />
          </div>
        ) : (
          <div className="pointer-events-auto mx-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-(--shadow-card) backdrop-blur-md">
            <p className="text-base font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            {featureFlags.timeTabs && (
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
            )}
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
  floatingIdeas: FloatingIdea[]
  selectedIdeaId: string | null
  onPin: (pin: PublicMapPin) => void
  onIdea: (idea: Idea) => void
}

/** No maps key (local dev, e2e) or the SDK failed: a flat backdrop with the
 * pins in fixed slots, like the signed-in map's fallback. */
function SignedOutStaticMap({
  now,
  pins,
  ideas,
  floatingIdeas,
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
      {floatingIdeas.map((idea, i) => (
        <FloatingIdeaStaticPin
          key={idea.id}
          idea={idea}
          index={i}
          selected={selectedIdeaId === idea.id}
          onSelect={onIdea}
        />
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
  const {
    center,
    now,
    pins,
    ideas,
    floatingIdeas,
    selectedIdeaId,
    onPin,
    onIdea,
  } = props
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
      {floatingIdeas.map((idea) => (
        <FloatingIdeaMarker
          key={`floating:${idea.id}`}
          idea={idea}
          selected={selectedIdeaId === idea.id}
          onSelect={onIdea}
        />
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
