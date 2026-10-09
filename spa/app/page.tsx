"use client"

import { Suspense, useRef, useState } from "react"
import { HomeCoachMarks } from "@/components/coach-marks"
import { MapView } from "@/components/map-view"
import { CalendarView } from "@/components/calendar-view"
import { EventDetailSheet } from "@/components/event-detail-sheet"
import { MenuDrawer } from "@/components/menu-drawer"
import { InviteDialog } from "@/components/qr-share-sheet"
import { FirstRunIntro } from "@/components/first-run-intro"
import { useActionFeedback } from "@/components/action-feedback"
import { useAuth } from "@/components/auth-provider"
import { KeptDraftWelcome } from "@/components/kept-draft-welcome"
import { useOnboardingChecklist } from "@/components/onboarding-checklist"
import { SignedOutHome } from "@/components/signed-out-home"
import {
  HeaderIconButton,
  HeaderPill,
  HomeTopBar,
  type HomeView,
} from "@/components/home-top-bar"
import {
  ListIcon,
  NavigationArrowIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons"
import {
  etaToIso,
  isImminent,
  isJoined,
  updateMyRsvp,
  type ArrivalStatus,
  type EventItem,
} from "@/lib/api/events"
import { useOnboardingFlags } from "@/lib/onboarding-flags"
import { etaControlKind, flareTiming } from "@/lib/flare-detail"
import { haptic } from "@/lib/haptics"
import { HttpError } from "@/lib/http"

export default function Home() {
  const { status } = useAuth()
  const { browseBeforeSignup } = useOnboardingFlags()
  // #389: AuthGate only lets a signed-out visitor this far with the flag on.
  if (browseBeforeSignup && status === "unauthenticated") {
    return <SignedOutHome />
  }
  return <SignedInHome />
}

function SignedInHome() {
  const { showActionFeedback } = useActionFeedback()
  const [view, setView] = useState<HomeView>("map")
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [activeRoute, setActiveRoute] = useState<EventItem | null>(null)
  const [routeEta, setRouteEta] = useState<string | null>(null)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const { user } = useAuth()
  // #459: after sign-up, a checklist in the map's sheet (in place of #313's
  // intro, with `introV2`).
  const { browseBeforeSignup, introV2 } = useOnboardingFlags()
  const checklist = useOnboardingChecklist(introV2)

  // Left-edge swipe to open MenuDrawer
  const swipeStartX = useRef<number | null>(null)
  const SWIPE_EDGE_PX = 32 // how close to the left edge the touch must start
  const SWIPE_DIST_PX = 64 // minimum horizontal travel to trigger

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX
    swipeStartX.current = x < SWIPE_EDGE_PX ? x : null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return
    const dist = e.changedTouches[0].clientX - swipeStartX.current
    swipeStartX.current = null
    if (dist > SWIPE_DIST_PX) {
      haptic("selection")
      setMenuOpen(true)
    }
  }

  const handleJoin = (event: EventItem, eta: string | null) => {
    // Optimistic UI: flip the going-badge immediately. If the PATCH fails we
    // revert below. `joinedIds` is a local overlay on top of `event.myRsvp`
    // from the API so the badge survives a refresh once the backend persists.
    setJoinedIds((prev) => {
      const next = new Set(prev)
      next.add(event.id)
      return next
    })
    // PATCH /events/:id/me — backend writes to EventMember (rsvpStatus +
    // memberWillArriveAt, or arrivalStatus for a flare starting within the
    // hour, #211). The "let host know" chip is the user's committed answer;
    // the Routes API ETA shown in the route pill is separate (display-only,
    // not persisted).
    const kind = etaControlKind(
      flareTiming({ startAt: event.startAt, endAt: event.endAt })
    )
    void updateMyRsvp(event.id, {
      rsvpStatus: "going",
      memberWillArriveAt: kind === "minutes" ? etaToIso(eta) : null,
      // Only sent for a near-term flare: the api rejects unknown body keys, so
      // an always-present `arrivalStatus: null` broke every join against an
      // api that hadn't shipped #211 yet.
      ...(kind === "status" && eta
        ? { arrivalStatus: eta as ArrivalStatus }
        : {}),
    })
      .then(() => showActionFeedback("you're in"))
      .catch((err) => {
        // Revert the optimistic add so the UI matches server state.
        console.error("[Sponti] failed to RSVP going", err)
        setJoinedIds((prev) => {
          const next = new Set(prev)
          next.delete(event.id)
          return next
        })
        // #181: the flare filled up between opening the sheet and tapping
        // join — a distinct, expected state, not a generic save failure.
        showActionFeedback(
          err instanceof HttpError && err.code === "EVENT_FULL"
            ? "full"
            : "couldn't save that",
          { tone: "error" }
        )
      })
    if (isImminent(event) && event.location.coordinates) {
      setActiveRoute(event)
      setRouteEta(null) // Routes API will fill this in via onRouteReady
      setView("map")
    }
    setSelectedEvent(null)
  }

  const handleSeeRoute = (event: EventItem) => {
    setActiveRoute(event)
    setRouteEta(null)
    setView("map")
    setSelectedEvent(null)
  }

  const handleLeave = (event: EventItem) => {
    // Optimistic remove. Same revert-on-error pattern as handleJoin.
    setJoinedIds((prev) => {
      const next = new Set(prev)
      next.delete(event.id)
      return next
    })
    // PATCH /events/:id/me with declined — backend keeps the EventMember row
    // but updates rsvpStatus, so any future invite history is preserved.
    void updateMyRsvp(event.id, { rsvpStatus: "declined" })
      .then(() => showActionFeedback("not this one"))
      .catch((err) => {
        console.error("[Sponti] failed to RSVP declined", err)
        setJoinedIds((prev) => {
          const next = new Set(prev)
          next.add(event.id)
          return next
        })
        showActionFeedback("couldn't save that", { tone: "error" })
      })
    if (activeRoute?.id === event.id) {
      setActiveRoute(null)
      setRouteEta(null)
    }
    setSelectedEvent(null)
  }

  const handleClearRoute = () => {
    setActiveRoute(null)
    setRouteEta(null)
  }

  const handleRouteReady = (event: EventItem, etaLabel: string) => {
    if (activeRoute?.id === event.id) setRouteEta(etaLabel)
  }

  return (
    // Fixed to the viewport, not a min-h-dvh block inside the body: the body's
    // safe-area padding made the document taller than the screen, so it
    // scrolled, and scrolling let Safari collapse its toolbars and lift the
    // page against the fixed nav (#223). A fixed page leaves nothing to
    // scroll; the map and calendar scroll inside themselves.
    <div
      className="fixed inset-0 flex w-full flex-col overflow-hidden bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Content Area — fills entire screen; header chips and nav float over it */}
      <div className="absolute inset-0 overflow-hidden">
        {view === "map" ? (
          <MapView
            onEventSelect={setSelectedEvent}
            activeRoute={activeRoute}
            joinedIds={joinedIds}
            onRouteReady={handleRouteReady}
            onSeeCalendar={() => setView("calendar")}
            dockCard={checklist}
          />
        ) : (
          <CalendarView
            onEventSelect={setSelectedEvent}
            joinedIds={joinedIds}
          />
        )}

        {/* Floating header chips — overlay the map/calendar content */}
        <HomeTopBar
          view={view}
          onViewChange={setView}
          left={
            <HeaderIconButton
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              data-coach="menu"
              onClick={() => {
                haptic("selection")
                setMenuOpen((v) => !v)
              }}
            >
              <ListIcon className="size-4" />
            </HeaderIconButton>
          }
          right={
            // #369: the invite pill, where the settings cog was (settings
            // moved into the menu). Not peach: the nav's flare button is the
            // screen's one peach call to action. Same shape as the signed-out
            // "sign in".
            <HeaderPill
              onClick={() => {
                haptic("selection")
                setInviteOpen(true)
              }}
              aria-haspopup="dialog"
            >
              <UserPlusIcon className="size-4" />
              invite
            </HeaderPill>
          }
        />

        {/* Route active pill — tap to reopen details, X to clear.
            top-[4.5rem] clears the floating header row (44px + inset + gap). */}
        {activeRoute && !selectedEvent && view === "map" && (
          <div className="absolute top-[4.5rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent py-1.5 pr-1.5 pl-3 text-xs font-medium text-accent-foreground shadow-md">
            <button
              onClick={() => setSelectedEvent(activeRoute)}
              className="flex items-center gap-2"
            >
              <NavigationArrowIcon className="h-3.5 w-3.5" />
              <span>
                routing to {activeRoute.location.name}
                {routeEta ? ` · ETA ${routeEta}` : ""}
              </span>
            </button>
            <button
              onClick={handleClearRoute}
              aria-label="Clear route"
              className="ml-1 rounded-full p-1 hover:bg-accent-foreground/10"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Event Detail Sheet — vaul drawer, portal-rendered at z-50 */}
      <EventDetailSheet
        open={!!selectedEvent}
        event={selectedEvent}
        joined={selectedEvent ? isJoined(selectedEvent, joinedIds) : false}
        isHost={!!user && !!selectedEvent && selectedEvent.hostId === user.id}
        onClose={() => setSelectedEvent(null)}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onSeeRoute={handleSeeRoute}
      />

      {/* #497 (behind `coachMarks`): the circles tab and the menu, once per
          device. Not over the checklist or any open sheet. */}
      <HomeCoachMarks
        blocked={view !== "map" || menuOpen || inviteOpen || !!selectedEvent}
        onboardingCard={checklist !== null}
      />

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      {inviteOpen && (
        <InviteDialog
          displayName={user?.displayName ?? "you"}
          handle={user?.username ?? "you"}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {/* #313: once, after a new account is made on this device. #389: an
          account made to light a kept draft gets the welcome back instead.
          #459: with `introV2` the checklist above replaces the intro. */}
      {browseBeforeSignup ? (
        <Suspense fallback={null}>
          <KeptDraftWelcome />
        </Suspense>
      ) : introV2 ? null : (
        <FirstRunIntro />
      )}
    </div>
  )
}
