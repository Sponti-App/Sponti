"use client"

// The flare detail page, layout D (#139, decided in #162): a map hero with
// the page content flush below it (header, when | where, host note, the
// viewer's own plan, then going / updates tabs), and a pinned action bar above
// the bottom nav that switches between "join" and "share an update". It is a
// page, not a drawer, so no handle or rounded sheet top (#352).

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  NavigationArrowIcon,
  PencilSimpleIcon,
} from "@/components/icons"
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
import { FlareMapHero, useFlareDirections } from "@/components/flare-map-hero"
import { Button } from "@/components/ui/button"
import { formatDistance, type HostedEvent } from "@/lib/api/events"
import {
  etaAvailable,
  flareStatusLine,
  flareTiming,
  flareViewer,
  googleMapsUrl,
  ownArrivalSummary,
  type FlareViewer,
} from "@/lib/flare-detail"
import { featureFlags } from "@/lib/feature-flags"
import { displayFlareTitle } from "@/lib/flare-title"
import { hasInAppHistory } from "@/lib/in-app-history"
import { flareDrawerPath } from "@/lib/shared-flare"
import { useHostedEvent } from "@/lib/use-hosted-event"
import { cn } from "@/lib/utils"

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  // #615: with the flare drawer on, this page only opens the drawer over the
  // home map, so every link and notification to a flare still works.
  const drawer = featureFlags.flareDrawer
  useEffect(() => {
    if (!drawer) return
    router.replace(
      flareDrawerPath(params.id, {
        search: window.location.search,
        back: hasInAppHistory(),
      })
    )
  }, [drawer, params.id, router])
  const { event, loading, error, setEvent, reload } = useHostedEvent(
    drawer ? null : params.id
  )

  if (drawer) return null

  if (loading) {
    return (
      <FrameMessage
        title="loading flare..."
        onBack={() => router.push("/event")}
      />
    )
  }

  if (!event) {
    return (
      <FrameMessage
        title="flare not found"
        detail={error ?? "it may have been deleted or you may not have access."}
        onBack={() => router.push("/event")}
      />
    )
  }

  const viewer = flareViewer({
    isHost: Boolean(user && event.hostId === user.id),
    myRsvp: event.myRsvp,
  })

  return (
    <FlareDetail
      // Remount when the viewer's relationship changes (join / leave) so the
      // tabs and composer start from that viewer's defaults.
      key={viewer}
      event={event}
      viewer={viewer}
      viewerId={user?.id}
      viewerName={user?.displayName}
      onEventChange={setEvent}
      onReload={reload}
    />
  )
}

function FlareDetail({
  event,
  viewer,
  viewerId,
  viewerName,
  onEventChange,
  onReload,
}: {
  event: HostedEvent
  viewer: FlareViewer
  viewerId?: string
  viewerName?: string
  onEventChange: (
    update: (current: HostedEvent | null) => HostedEvent | null
  ) => void
  /** Refetches the flare, e.g. so the guest list catches up after joining. */
  onReload: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const timing = flareTiming({
    startAt: event.startAt,
    endAt: event.endAt,
    cancelled: event.apiStatus === "cancelled",
  })
  const isHost = viewer === "host"
  const canSeeThread = viewer !== "invited"
  const threadOpen = timing !== "ended" && timing !== "cancelled"
  const thread = useEventThread(event.id, { enabled: canSeeThread })

  const [tab, setTab] = useState<FlareTab>(() =>
    searchParams.get("tab") === "updates" ? "updates" : "guests"
  )
  const [composing, setComposing] = useState(
    () => canSeeThread && threadOpen && searchParams.get("compose") === "1"
  )
  const composerRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (composing) composerRef.current?.focus()
  }, [composing])
  const openComposer = () => {
    setTab("updates")
    setComposing(true)
  }

  const {
    eta,
    setEta,
    editingEta,
    setEditingEta,
    saving,
    rsvpError,
    join,
    decline,
    changeEta,
    clearArrival,
  } = useFlareMembership({
    event,
    timing,
    viewerId,
    onEventChange,
    onReload,
  })

  const hostName = flareHostName(event)
  const hostFirstName = hostName.split(" ")[0]
  const mapsUrl = googleMapsUrl({
    coordinates: event.coordinates,
    name: [event.locationLabel, event.locationDetail]
      .filter(Boolean)
      .join(", "),
  })
  const directions = useFlareDirections({
    coordinates: event.coordinates,
    viewer,
  })
  const hasBar = threadOpen

  return (
    <div className="min-h-dvh bg-background">
      <div
        className={cn(
          "h-dvh overflow-y-auto",
          hasBar
            ? "pb-[calc(var(--sponti-nav-h,64px)+6.5rem)]"
            : "pb-[calc(var(--sponti-nav-h,64px)+1.5rem)]"
        )}
      >
        <FlareMapHero
          coordinates={event.coordinates}
          type={event.type}
          directions={directions}
        >
          <div className="absolute inset-x-0 top-0 flex justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <HeroButton label="back" onClick={() => router.push("/event")}>
              <ArrowLeftIcon className="h-4 w-4" />
            </HeroButton>
            {isHost && (
              <div className="flex items-center gap-2">
                {/* #616: the flare's own invite link, for people who are not
                    on sponti yet. Not for a flare that is over: its link no
                    longer works. */}
                {featureFlags.flareInviteLink &&
                  timing !== "ended" &&
                  timing !== "cancelled" && (
                    <FlareInviteButton
                      event={event}
                      hostName={viewerName ?? event.hostName}
                    />
                  )}
                <HeroButton
                  label="edit flare"
                  disabled={timing === "ended"}
                  onClick={() => router.push(`/event/${event.id}/edit`)}
                >
                  <PencilSimpleIcon className="h-4 w-4" />
                </HeroButton>
              </div>
            )}
          </div>
          {/* "open in maps": always available, near or far. */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute right-4 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm"
          >
            <NavigationArrowIcon className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">open in maps</span>
            {directions.travelLabel && !isHost && (
              <span className="text-muted-foreground">
                · {directions.travelLabel}
              </span>
            )}
          </a>
        </FlareMapHero>

        <div className="bg-background px-4 pt-4">
          <FlareHeader
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
              mapsUrl={mapsUrl}
            />
          </div>

          {rsvpError && (
            <p
              className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {rsvpError}
            </p>
          )}

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
                eta={eta}
                timing={timing}
                editing={editingEta}
                onEditingChange={setEditingEta}
                onEtaChange={changeEta}
                onClearEta={clearArrival}
                onLeave={decline}
                saving={saving}
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
            onTabChange={setTab}
            className="mt-5"
          />
        </div>
      </div>

      {hasBar && (
        <div className="fixed inset-x-0 bottom-[var(--sponti-nav-h,64px)] z-30 border-t border-border/60 bg-background/95 px-4 pt-1.5 pb-2 backdrop-blur">
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
              eta={eta}
              onEtaChange={setEta}
              saving={saving}
              onJoin={join}
              onDecline={decline}
              onShareUpdate={openComposer}
            />
          )}
        </div>
      )}
    </div>
  )
}

function HeroButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-10 w-10 rounded-full bg-background/90"
    >
      {children}
    </Button>
  )
}

function FrameMessage({
  title,
  detail,
  onBack,
}: {
  title: string
  detail?: string
  onBack: () => void
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      <Button
        onClick={onBack}
        className="mt-4 rounded-full bg-accent text-accent-foreground"
      >
        back to flares
      </Button>
    </div>
  )
}
