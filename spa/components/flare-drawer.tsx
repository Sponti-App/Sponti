"use client"

// One flare detail (#615): a drawer over the home map at three heights, in
// place of both the map's sheet and the flare page. Peek holds the title and
// time; half adds when and where, directions and the host; full adds the
// viewer's plan and the going / updates tabs, and stops short of the top so a
// strip of map stays above it. The main action (join, share an update) sits in
// a bar pinned above the nav at every height, and turns into the update
// composer there. The map behind stays live (one finger moves it) and keeps
// the flare centred in what's left.

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Drawer } from "vaul"
import { FocusScope } from "@radix-ui/react-focus-scope"
import { Button } from "@/components/ui/button"
import { useActionFeedback } from "@/components/action-feedback"
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
  StopCircleIcon,
  XIcon,
} from "@/components/icons"
import { formatDistance, updateEvent, type HostedEvent } from "@/lib/api/events"
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
import { emitEventsChanged } from "@/lib/use-events"
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
  // The drawer is the screen's full height and slides down to each snap
  // point, so this much of it is below the screen and can't be scrolled to.
  const offscreen =
    geometry && activeSnapPoint
      ? geometry.viewportHeight - coverOf(activeSnapPoint)
      : 0
  useEffect(() => {
    onCoverChange(cover)
  }, [cover, onCoverChange])

  // Below full the content doesn't scroll, so leaving full with it scrolled
  // down would keep the header cut off. Back to the top as the drawer drops.
  const scrollerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (snap !== "full")
      scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [snap])

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
      // The composer lives in the action bar, outside the drawer, and lifts
      // itself above the keyboard; vaul resizing the drawer for it would
      // throw the whole drawer to the top of the screen.
      repositionInputs={false}
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
            className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/70"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <div
            ref={scrollerRef}
            // Scrolls only at full; below that a drag moves the drawer.
            className={cn(
              "min-h-0 flex-1 px-4",
              snap === "full"
                ? "overflow-y-auto overscroll-contain"
                : "overflow-hidden"
            )}
            style={{
              paddingBottom: `calc(var(--sponti-nav-h, 64px) + ${offscreen}px + 1rem)`,
            }}
          >
            {event && viewer ? (
              <DrawerBody
                // Fresh tabs and composer when the viewer joins or leaves.
                key={`${event.id}:${viewer}`}
                event={event}
                viewer={viewer}
                open={open}
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
  open,
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
  open: boolean
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

  const barShown = open && threadOpen
  const barRef = useRef<HTMLDivElement>(null)
  const barHeight = useHeight(barRef, barShown)
  const keyboard = useKeyboardInset()

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
          aside={
            isHost &&
            threadOpen && (
              // Reaches under the close button: invite under "hosting",
              // edit under the x.
              <div className="-mr-12 flex gap-2">
                {/* #616: the flare's own invite link, for people who are
                    not on sponti yet. */}
                {featureFlags.flareInviteLink && (
                  <FlareInviteButton
                    compact
                    event={event}
                    hostName={viewerName ?? event.hostName}
                  />
                )}
                {event.openEnd && timing === "live" && (
                  <EndNowButton eventId={event.id} onEnded={onReload} />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="edit"
                  className="size-9 rounded-full bg-muted text-foreground hover:bg-muted/70"
                  onClick={() => router.push(`/event/${event.id}/edit`)}
                >
                  <PencilSimpleIcon className="h-4 w-4" />
                </Button>
              </div>
            )
          }
        />
      </div>

      <div className="mt-4">
        <FlareFacts
          when={whenLabel(event.startAt, timing)}
          until={
            event.openEnd ? undefined : `until ${formatClock(event.endAt)}`
          }
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

      {/* Room for the action bar, so the end of the list scrolls past it. */}
      <div aria-hidden data-flare-bar-room style={{ height: barHeight }} />

      {barShown &&
        createPortal(
          // vaul keeps Radix's focus trap on even with modal={false}, and the
          // trap pulls focus out of anything outside the drawer's DOM, so on
          // iOS the composer lost focus and closed the moment it opened.
          // Mounting a scope here pauses the drawer's while the bar is up. It
          // must mount after the drawer's, which holds as the bar waits for
          // the flare to load, and share its stack: the package is pinned to
          // the version radix-ui's Dialog uses.
          <FocusScope
            asChild
            onMountAutoFocus={(e) => e.preventDefault()}
            onUnmountAutoFocus={(e) => e.preventDefault()}
          >
            <div
              ref={barRef}
              data-flare-action-bar
              // Outside the drawer, so it stays above the nav at every height
              // and while the drawer moves. Pointer events still bubble to the
              // drawer through React, where vaul would read them as a drag.
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="fixed inset-x-0 z-[36] border-t border-border/60 bg-background px-4 py-2"
              style={{
                bottom:
                  composing && keyboard > 0
                    ? keyboard
                    : "var(--sponti-nav-h, 64px)",
              }}
            >
              {membership.rsvpError && (
                <p
                  className="mb-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                  role="alert"
                >
                  {membership.rsvpError}
                </p>
              )}
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
          </FocusScope>,
          document.body
        )}
    </>
  )
}

/**
 * Directions, as a choice: the walking route on sponti's own map, or google
 * maps. The old page's "open in maps" left the app on a single tap.
 */
/**
 * #614: ends a flare with an open end. The first tap asks ("end now?"), the
 * second saves the end as now; moving focus away asks again next time.
 */
function EndNowButton({
  eventId,
  onEnded,
}: {
  eventId: string
  onEnded: () => void
}) {
  const { showActionFeedback } = useActionFeedback()
  const [asking, setAsking] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!asking) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="end now"
        className="size-9 rounded-full bg-muted text-foreground hover:bg-muted/70"
        onClick={() => setAsking(true)}
      >
        <StopCircleIcon className="h-4 w-4" />
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      autoFocus
      disabled={saving}
      className="h-9 rounded-full bg-muted px-3 text-sm text-destructive hover:bg-muted/70"
      onBlur={() => setAsking(false)}
      onClick={async () => {
        setSaving(true)
        try {
          await updateEvent(eventId, { endAt: new Date().toISOString() })
          emitEventsChanged()
          showActionFeedback("flare ended")
          onEnded()
        } catch {
          showActionFeedback("couldn't end it", { tone: "error" })
        } finally {
          setSaving(false)
          setAsking(false)
        }
      }}
    >
      end now?
    </Button>
  )
}

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

/** An element's height while it's shown, 0 otherwise. */
function useHeight(ref: RefObject<HTMLElement | null>, shown: boolean): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!shown || !el) return
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, shown])
  return shown ? height : 0
}

// Below this, a smaller visual viewport is browser chrome, not a keyboard.
const KEYBOARD_MIN_PX = 80

function readKeyboardInset(): number {
  const vv = window.visualViewport
  if (!vv) return 0
  const inset = Math.round(window.innerHeight - vv.height - vv.offsetTop)
  return inset > KEYBOARD_MIN_PX ? inset : 0
}
function subscribeKeyboard(onChange: () => void) {
  const vv = window.visualViewport
  vv?.addEventListener("resize", onChange)
  vv?.addEventListener("scroll", onChange)
  return () => {
    vv?.removeEventListener("resize", onChange)
    vv?.removeEventListener("scroll", onChange)
  }
}

/** How far the on-screen keyboard reaches up from the bottom, in px. */
function useKeyboardInset(): number {
  return useSyncExternalStore(subscribeKeyboard, readKeyboardInset, () => 0)
}
