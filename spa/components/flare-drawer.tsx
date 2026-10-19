"use client"

// One flare detail (#615): a drawer over the home map at three heights, in
// place of both the map's sheet and the flare page. Peek holds the title,
// time and main action; half adds when and where, directions and the host;
// full adds the viewer's plan and the going / updates tabs, and stops short
// of the top so a strip of map stays above it. The map behind stays live
// (one finger moves it) and keeps the flare centred in what's left.

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Drawer } from "vaul"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { EventThreadComposer, useEventThread } from "@/components/event-thread"
import {
  FlareActions,
  FlareFacts,
  FlareHeader,
  YourPlan,
} from "@/components/flare-detail"
import {
  FlareGuestsAndUpdates,
  FlareHost,
  flareHostName,
  formatClock,
  useFlareMembership,
  whenLabel,
  type FlareTab,
} from "@/components/flare-detail-parts"
import { FlareInviteButton } from "@/components/flare-invite-button"
import { useFlareDirections } from "@/components/flare-map-hero"
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  NavigationArrowIcon,
  PencilSimpleIcon,
  XIcon,
} from "@/components/icons"
import { formatDistance, type HostedEvent } from "@/lib/api/events"
import { featureFlags } from "@/lib/feature-flags"
import {
  etaAvailable,
  flareStatusLine,
  flareTiming,
  flareViewer,
  googleMapsUrl,
  ownArrivalSummary,
  type FlareViewer,
} from "@/lib/flare-detail"
import {
  coverOf,
  drawerSnapPoints,
  snapAt,
  snapIndex,
  type DrawerSnap,
} from "@/lib/flare-drawer"
import { displayFlareTitle } from "@/lib/flare-title"
import { haptic } from "@/lib/haptics"
import { useHostedEvent } from "@/lib/use-hosted-event"
import { cn } from "@/lib/utils"

export type FlareDrawerProps = {
  /** The flare to show; null renders nothing. */
  eventId: string | null
  open: boolean
  initialSnap?: DrawerSnap
  initialTab?: FlareTab
  /** Open with the update composer (a "share an update" link). */
  compose?: boolean
  onClose: () => void
  /** Called once the drawer has finished closing. */
  onClosed?: () => void
  /** How much of the screen the drawer covers (nav included), in px. */
  onCoverChange: (px: number) => void
  onEventLoaded?: (event: HostedEvent) => void
  /** The in-app walking route to the flare, drawn on the map. */
  onSeeRoute: (event: HostedEvent) => void
  /** The viewer joined (true) or said they can't make it (false). */
  onRsvpChange?: (eventId: string, going: boolean) => void
}

export function FlareDrawer({
  eventId,
  open,
  initialSnap = "half",
  initialTab,
  compose = false,
  onClose,
  onClosed,
  onCoverChange,
  onEventLoaded,
  onSeeRoute,
  onRsvpChange,
}: FlareDrawerProps) {
  const { user } = useAuth()
  const geometry = useDrawerGeometry()
  const snapPoints = geometry
    ? drawerSnapPoints(geometry.viewportHeight, geometry.navHeight)
    : null
  const [snap, setSnap] = useState<DrawerSnap>(compose ? "full" : initialSnap)
  const activeSnapPoint = snapPoints ? snapPoints[snapIndex(snap)] : null

  const cover = open && activeSnapPoint ? coverOf(activeSnapPoint) : 0
  useEffect(() => {
    onCoverChange(cover)
  }, [cover, onCoverChange])

  const loaded = useHostedEvent(eventId)
  const event = loaded.event
  useEffect(() => {
    if (event) onEventLoaded?.(event)
  }, [event, onEventLoaded])

  // Haptic on open, like the map's sheet.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) haptic("light")
    wasOpen.current = open
  }, [open])

  if (!eventId || !snapPoints) return null

  const viewer = event
    ? flareViewer({
        isHost: Boolean(user && event.hostId === user.id),
        myRsvp: event.myRsvp,
      })
    : null

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          haptic("light")
          onClose()
        }
      }}
      onAnimationEnd={(isOpen) => {
        if (!isOpen) onClosed?.()
      }}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={(point) => {
        const index = snapPoints.findIndex((p) => p === point)
        if (index >= 0) setSnap(snapAt(index))
      }}
      // The map stays live behind the drawer: one finger moves it at any
      // height, and a tap on another pin opens that flare.
      modal={false}
      dismissible
    >
      <Drawer.Portal>
        {/* Under the bottom nav (z-40), which stays lit and tappable: the
            drawer runs behind it and pads its content by the nav's height.
            `after:hidden` turns off vaul's ::after, which would paint over
            the nav (#296/#301). */}
        <Drawer.Content
          data-flare-drawer={eventId}
          data-snap={snap}
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[35] flex h-full flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) outline-none after:hidden"
        >
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <Drawer.Title className="sr-only">
            {event
              ? displayFlareTitle({
                  title: event.title,
                  type: event.type,
                  hostName: event.hostName,
                  isHost: viewer === "host",
                })
              : "flare"}
          </Drawer.Title>
          <button
            type="button"
            aria-label="close"
            onClick={() => {
              haptic("light")
              onClose()
            }}
            className="absolute top-4 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/70"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <div
            // Scrolls only at full; below that a drag moves the drawer.
            className={cn(
              "min-h-0 flex-1 px-4 pb-[calc(var(--sponti-nav-h,64px)+1.5rem)]",
              snap === "full"
                ? "overflow-y-auto overscroll-contain"
                : "overflow-hidden"
            )}
          >
            {event && viewer ? (
              <DrawerBody
                // Fresh tabs and composer when the viewer joins or leaves.
                key={`${event.id}:${viewer}`}
                event={event}
                viewer={viewer}
                viewerId={user?.id}
                viewerName={user?.displayName}
                initialTab={initialTab}
                compose={compose}
                onEventChange={loaded.setEvent}
                onReload={loaded.reload}
                onExpand={() => setSnap("full")}
                onSeeRoute={onSeeRoute}
                onRsvpChange={onRsvpChange}
              />
            ) : (
              <div className="pt-2 pr-12">
                <p className="text-sm font-semibold">
                  {loaded.loading ? "loading flare..." : "flare not found"}
                </p>
                {!loaded.loading && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {loaded.error ??
                      "it may have been deleted or you may not have access."}
                  </p>
                )}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function DrawerBody({
  event,
  viewer,
  viewerId,
  viewerName,
  initialTab,
  compose,
  onEventChange,
  onReload,
  onExpand,
  onSeeRoute,
  onRsvpChange,
}: {
  event: HostedEvent
  viewer: FlareViewer
  viewerId?: string
  viewerName?: string
  initialTab?: FlareTab
  compose: boolean
  onEventChange: (
    update: (current: HostedEvent | null) => HostedEvent | null
  ) => void
  onReload: () => void
  onExpand: () => void
  onSeeRoute: (event: HostedEvent) => void
  onRsvpChange?: (eventId: string, going: boolean) => void
}) {
  const router = useRouter()
  const timing = flareTiming({
    startAt: event.startAt,
    endAt: event.endAt,
    cancelled: event.apiStatus === "cancelled",
  })
  const isHost = viewer === "host"
  const canSeeThread = viewer !== "invited"
  const threadOpen = timing !== "ended" && timing !== "cancelled"
  const thread = useEventThread(event.id, { enabled: canSeeThread })

  const [tab, setTab] = useState<FlareTab>(initialTab ?? "guests")
  const [composing, setComposing] = useState(
    () => canSeeThread && threadOpen && compose
  )
  const composerRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (composing) composerRef.current?.focus()
  }, [composing])
  const openComposer = () => {
    setTab("updates")
    setComposing(true)
    onExpand()
  }

  const membership = useFlareMembership({
    event,
    timing,
    viewerId,
    onEventChange,
    onReload,
  })
  // Tell the map when the viewer joins or leaves, for its "going" pins.
  const rsvp = event.myRsvp
  const lastRsvp = useRef(rsvp)
  useEffect(() => {
    if (lastRsvp.current === rsvp) return
    lastRsvp.current = rsvp
    onRsvpChange?.(event.id, rsvp === "going")
  }, [event.id, rsvp, onRsvpChange])

  const directions = useFlareDirections({
    coordinates: event.coordinates,
    viewer,
  })
  const mapsUrl = googleMapsUrl({
    coordinates: event.coordinates,
    name: [event.locationLabel, event.locationDetail]
      .filter(Boolean)
      .join(", "),
  })
  const hostFirstName = flareHostName(event).split(" ")[0]

  return (
    <>
      <div className="pr-12">
        <FlareHeader
          as="h2"
          type={event.type}
          title={displayFlareTitle({
            title: event.title,
            type: event.type,
            hostName: event.hostName,
            isHost,
          })}
          statusLine={flareStatusLine(event, timing)}
          timing={timing}
          viewer={viewer}
        />
      </div>

      {/* The main action, as on the old page's pinned bar. */}
      {threadOpen && (
        <div className="mt-3">
          {composing && canSeeThread && !thread.closedByServer ? (
            <EventThreadComposer
              ref={composerRef}
              thread={thread}
              placeholder={
                isHost ? "announce to everyone..." : "say something..."
              }
              onClose={() => setComposing(false)}
            />
          ) : (
            <FlareActions
              viewer={viewer}
              timing={timing}
              declined={event.myRsvp === "declined"}
              eta={membership.eta}
              onEtaChange={membership.setEta}
              saving={membership.saving}
              onJoin={membership.join}
              onDecline={membership.decline}
              onShareUpdate={openComposer}
            />
          )}
        </div>
      )}

      {membership.rsvpError && (
        <p
          className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {membership.rsvpError}
        </p>
      )}

      <div className="mt-4">
        <FlareFacts
          when={whenLabel(event.startAt, timing)}
          until={`until ${formatClock(event.endAt)}`}
          placeName={event.locationLabel}
          placeDetail={
            [
              directions.distanceMeters !== null && !isHost
                ? formatDistance(directions.distanceMeters)
                : null,
              event.locationDetail,
            ]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
        <DirectionsRow
          travelLabel={isHost ? null : directions.travelLabel}
          canRoute={Boolean(event.coordinates) && threadOpen}
          mapsUrl={mapsUrl}
          onSeeRoute={() => onSeeRoute(event)}
        />
      </div>

      <FlareHost event={event} isHost={isHost} />

      {isHost && threadOpen && (
        <div className="mt-3 flex items-center gap-2">
          {/* #616: the flare's own invite link, for people who are not on
              sponti yet. */}
          {featureFlags.flareInviteLink && (
            <FlareInviteButton
              event={event}
              hostName={viewerName ?? event.hostName}
            />
          )}
          <Button
            variant="outline"
            className="h-10 gap-1.5 rounded-full px-3.5 text-sm"
            onClick={() => router.push(`/event/${event.id}/edit`)}
          >
            <PencilSimpleIcon className="h-4 w-4" />
            edit
          </Button>
        </div>
      )}

      {viewer === "joined" && etaAvailable(timing) && (
        <div className="mt-4">
          <YourPlan
            summary={
              ownArrivalSummary({
                willArriveAt: event.myWillArriveAt,
                arrivalStatus: event.myArrivalStatus,
              }) ?? "no arrival time shared"
            }
            hostFirstName={hostFirstName}
            hasEta={Boolean(event.myWillArriveAt || event.myArrivalStatus)}
            eta={membership.eta}
            timing={timing}
            editing={membership.editingEta}
            onEditingChange={membership.setEditingEta}
            onEtaChange={membership.changeEta}
            onClearEta={membership.clearArrival}
            onLeave={membership.decline}
            saving={membership.saving}
          />
        </div>
      )}

      <FlareGuestsAndUpdates
        event={event}
        viewer={viewer}
        viewerId={viewerId}
        timing={timing}
        thread={thread}
        tab={tab}
        onTabChange={(next) => {
          setTab(next)
          onExpand()
        }}
        className="mt-5"
      />
    </>
  )
}

/**
 * Directions, as a choice: the walking route on sponti's own map, or google
 * maps. The old page's "open in maps" left the app on a single tap.
 */
function DirectionsRow({
  travelLabel,
  canRoute,
  mapsUrl,
  onSeeRoute,
}: {
  travelLabel: string | null
  canRoute: boolean
  mapsUrl: string
  onSeeRoute: () => void
}) {
  const [choosing, setChoosing] = useState(false)
  return (
    <div className="border-b border-border/60">
      <button
        type="button"
        aria-expanded={choosing}
        onClick={() => {
          haptic("selection")
          setChoosing((v) => !v)
        }}
        className="flex min-h-11 w-full items-center gap-2 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-70"
      >
        <NavigationArrowIcon className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">directions</span>
        {travelLabel && (
          <span className="text-xs text-muted-foreground">{travelLabel}</span>
        )}
        <CaretRightIcon
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            choosing && "rotate-90"
          )}
        />
      </button>
      {choosing && (
        <div className="grid grid-cols-2 gap-2 pb-3">
          {canRoute && (
            <Button
              variant="ghost"
              className="h-10 rounded-full bg-muted text-sm text-foreground hover:bg-muted/70"
              onClick={() => {
                haptic("medium")
                onSeeRoute()
              }}
            >
              see route
            </Button>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-muted text-sm font-medium active:bg-muted/70",
              !canRoute && "col-span-2"
            )}
          >
            google maps
            <ArrowSquareOutIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      )}
    </div>
  )
}

type DrawerGeometry = { viewportHeight: number; navHeight: number }

let geometryCache: DrawerGeometry | null = null
function readGeometry(): DrawerGeometry {
  // The layout viewport, not the visual one: the keyboard opening for the
  // composer must not move the snap points (vaul lifts the input itself).
  const viewportHeight = window.innerHeight
  const nav = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--sponti-nav-h"
    )
  )
  const navHeight = Number.isFinite(nav) && nav > 0 ? nav : 64
  // Same object while nothing changed, as useSyncExternalStore needs.
  if (
    !geometryCache ||
    geometryCache.viewportHeight !== viewportHeight ||
    geometryCache.navHeight !== navHeight
  ) {
    geometryCache = { viewportHeight, navHeight }
  }
  return geometryCache
}
function subscribeGeometry(onChange: () => void) {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

/** The screen and nav heights the snap points are measured from. */
function useDrawerGeometry(): DrawerGeometry | null {
  return useSyncExternalStore(subscribeGeometry, readGeometry, () => null)
}
