"use client"

// The flare detail page, layout D (#139, decided in #162): a map hero with
// the sheet below it (header, when | where, host note, the viewer's own plan,
// then going / updates tabs), and a pinned action bar above the bottom nav
// that switches between "join" and "share an update".

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Lock, Navigation, Pencil } from "lucide-react"
import { useActionFeedback } from "@/components/action-feedback"
import { useAuth } from "@/components/auth-provider"
import { initials } from "@/components/event-avatar-stack"
import {
  EventThreadComposer,
  EventThreadList,
  EventThreadLocked,
  useEventThread,
} from "@/components/event-thread"
import {
  FlareActions,
  FlareFacts,
  FlareHeader,
  YourPlan,
} from "@/components/flare-detail"
import { FlareMapHero, useFlareDirections } from "@/components/flare-map-hero"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  arrivalStatusLabel,
  etaToIso,
  fetchHostedEventById,
  formatArrivalStatus,
  formatDistance,
  updateMyRsvp,
  type ArrivalStatus,
  type HostedEvent,
} from "@/lib/api/events"
import {
  etaAvailable,
  etaControlKind,
  flareStatusLine,
  flareTiming,
  flareViewer,
  googleMapsUrl,
  ownArrivalSummary,
  spotsLeftLabel,
  type FlareTiming,
  type FlareViewer,
} from "@/lib/flare-detail"
import { HttpError } from "@/lib/http"
import { useRefetchOnFocus } from "@/lib/use-refetch-on-focus"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"

const TAB_TRIGGER =
  "text-sm data-active:bg-card data-active:text-primary dark:data-active:bg-card dark:data-active:text-primary"

type Tab = "guests" | "updates"

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [event, setEvent] = useState<HostedEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()

    queueMicrotask(() => {
      if (ac.signal.aborted) return
      setLoading(true)
      setError(null)
    })

    fetchHostedEventById(params.id, ac.signal)
      .then((nextEvent) => {
        setEvent(nextEvent)
        setLoading(false)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        setError(err instanceof Error ? err.message : "could not load flare")
        setLoading(false)
      })

    return () => ac.abort()
  }, [params.id])

  // Refetch when the tab/app regains focus (#158): otherwise the guest list
  // and rsvp count only catch up with another account's changes once this
  // page remounts. Deliberately doesn't touch `loading`/`error` so it
  // doesn't flash the full loading screen on a background refresh.
  const refetchAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => refetchAbortRef.current?.abort()
  }, [])
  const reload = () => {
    refetchAbortRef.current?.abort()
    const ac = new AbortController()
    refetchAbortRef.current = ac
    fetchHostedEventById(params.id, ac.signal)
      .then(setEvent)
      .catch((err) => {
        if (ac.signal.aborted) return
        console.warn("[Sponti] event refetch failed:", err)
      })
  }
  useRefetchOnFocus(reload)

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
      onEventChange={setEvent}
      onReload={reload}
    />
  )
}

function FlareDetail({
  event,
  viewer,
  viewerId,
  onEventChange,
  onReload,
}: {
  event: HostedEvent
  viewer: FlareViewer
  viewerId?: string
  onEventChange: (update: (current: HostedEvent | null) => HostedEvent | null) => void
  /** Refetches the flare, e.g. so the guest list catches up after joining. */
  onReload: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showActionFeedback } = useActionFeedback()

  const timing = flareTiming({
    startAt: event.startAt,
    endAt: event.endAt,
    cancelled: event.apiStatus === "cancelled",
  })
  const isHost = viewer === "host"
  const canSeeThread = viewer !== "invited"
  const threadOpen = timing !== "ended" && timing !== "cancelled"
  const thread = useEventThread(event.id, { enabled: canSeeThread })

  const [tab, setTab] = useState<Tab>(() =>
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

  const [eta, setEta] = useState<string | null>(null)
  const [editingEta, setEditingEta] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rsvpError, setRsvpError] = useState<string | null>(null)

  const saveMembership = async (
    body: Parameters<typeof updateMyRsvp>[1],
    success: string,
    apply: (current: HostedEvent) => HostedEvent
  ) => {
    if (saving) return
    setSaving(true)
    setRsvpError(null)
    try {
      await updateMyRsvp(event.id, body)
      onEventChange((current) => (current ? apply(current) : current))
      showActionFeedback(success)
      onReload()
    } catch (err) {
      // #181: the flare hit its guest limit between opening this page and
      // tapping join — a distinct, expected state, not a generic failure.
      if (err instanceof HttpError && err.code === "EVENT_FULL") {
        setRsvpError("this flare is full")
        showActionFeedback("full", { tone: "error" })
      } else {
        setRsvpError(err instanceof Error ? err.message : "could not update rsvp")
        showActionFeedback("couldn't save that", { tone: "error" })
      }
    } finally {
      setSaving(false)
    }
  }

  const join = () => {
    const kind = etaControlKind(timing)
    const willArriveAt = kind === "minutes" ? etaToIso(eta) : null
    const arrivalStatus = kind === "status" ? (eta as ArrivalStatus | null) : null
    void saveMembership(
      {
        rsvpStatus: "going",
        memberWillArriveAt: willArriveAt,
        // Omitted rather than null when unused: the api rejects unknown keys,
        // so a null here broke joins against an api without #211.
        ...(arrivalStatus ? { arrivalStatus } : {}),
      },
      "you're in",
      (current) => ({
        ...current,
        myRsvp: "going",
        myWillArriveAt: willArriveAt,
        myArrivalStatus: arrivalStatus,
        attendingCount:
          current.myRsvp === "going" ? current.attendingCount : current.attendingCount + 1,
      })
    )
  }
  const decline = () =>
    void saveMembership({ rsvpStatus: "declined" }, "not this one", (current) => ({
      ...current,
      myRsvp: "declined",
      myWillArriveAt: null,
      myArrivalStatus: null,
      attendingCount:
        current.myRsvp === "going"
          ? Math.max(0, current.attendingCount - 1)
          : current.attendingCount,
      attendees: (current.attendees ?? []).filter((a) => a.id !== viewerId),
    }))
  // Sets a new answer, of whichever kind the current timing offers.
  const changeEta = (choice: string) => {
    setEta(choice)
    setEditingEta(false)
    if (etaControlKind(timing) === "status") {
      const arrivalStatus = choice as ArrivalStatus
      void saveMembership(
        { arrivalStatus },
        "host knows",
        (current) => ({ ...current, myArrivalStatus: arrivalStatus, myWillArriveAt: null })
      )
      return
    }
    const willArriveAt = etaToIso(choice)
    void saveMembership(
      { memberWillArriveAt: willArriveAt },
      willArriveAt ? "host knows" : "eta cleared",
      (current) => ({ ...current, myWillArriveAt: willArriveAt, myArrivalStatus: null })
    )
  }
  // Clears whichever answer is actually stored, independent of what the
  // picker would currently show (the flare may have tipped from "soon" to
  // "live" since the answer was given).
  const clearArrival = () => {
    setEta(null)
    setEditingEta(false)
    if (event.myArrivalStatus) {
      void saveMembership(
        { arrivalStatus: null },
        "eta cleared",
        (current) => ({ ...current, myArrivalStatus: null })
      )
      return
    }
    void saveMembership(
      { memberWillArriveAt: null },
      "eta cleared",
      (current) => ({ ...current, myWillArriveAt: null })
    )
  }

  const hostName = (event.hostName ?? event.hostUsername ?? "host").toLowerCase()
  const hostFirstName = hostName.split(" ")[0]
  const category = EVENT_TYPES.find((t) => t.value === event.type)?.label
  const mapsUrl = googleMapsUrl({
    coordinates: event.coordinates,
    name: [event.locationLabel, event.locationDetail].filter(Boolean).join(", "),
  })
  const directions = useFlareDirections({ coordinates: event.coordinates, viewer })
  const guests = event.attendees ?? []
  const spots = spotsLeftLabel({
    visibility: event.visibility,
    guestLimit: event.guestLimit,
    // +1s count towards the limit once #159 ships them; until then it's people.
    headcount: event.attendingCount,
    allowGuestInvites: event.allowGuestInvites,
  })
  const updateCount = canSeeThread && !thread.loading
    ? thread.updates.length
    : (event.updateCount ?? 0)
  const closedNote =
    timing === "cancelled"
      ? "this flare was cancelled · the thread is read-only"
      : timing === "ended"
        ? "this flare has ended · the thread is read-only"
        : null
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
              <ArrowLeft className="h-4 w-4" />
            </HeroButton>
            {isHost && (
              <HeroButton
                label="edit flare"
                disabled={timing === "ended"}
                onClick={() => router.push(`/event/${event.id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
              </HeroButton>
            )}
          </div>
          {/* "open in maps": always available, near or far. */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute right-4 bottom-9 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm"
          >
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">open in maps</span>
            {directions.travelLabel && !isHost && (
              <span className="text-muted-foreground">· {directions.travelLabel}</span>
            )}
          </a>
        </FlareMapHero>

        <div className="relative -mt-6 rounded-t-3xl bg-background px-4 pt-3 shadow-(--shadow-sheet)">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" />

          <FlareHeader
            type={event.type}
            title={event.title}
            statusLine={flareStatusLine(event, timing)}
            timing={timing}
            viewer={viewer}
          />

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

          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted p-3">
            <Avatar className="size-7">
              {event.hostAvatarUrl && <AvatarImage src={event.hostAvatarUrl} alt="" />}
              <AvatarFallback className="text-xs">
                {initials(hostName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {isHost ? "hosted by you" : `hosted by ${hostName}`}
                <span className="font-normal text-muted-foreground">
                  {category && ` · ${category}`}
                  {event.visibility === "private" && " · private"}
                </span>
              </p>
              {event.description?.trim() && (
                <p className="mt-0.5 text-sm wrap-break-word text-muted-foreground">
                  {event.description.trim().toLowerCase()}
                </p>
              )}
            </div>
          </div>

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

          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as Tab)}
            className="mt-5"
          >
            <TabsList className="h-9 w-full">
              <TabsTrigger value="guests" className={TAB_TRIGGER}>
                {event.attendingCount} going
              </TabsTrigger>
              <TabsTrigger value="updates" className={TAB_TRIGGER}>
                {!canSeeThread && <Lock className="h-3 w-3" />}
                updates · {updateCount}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guests" className="pt-2 pb-4">
              {spots && <p className="mb-2 text-xs text-muted-foreground">{spots}</p>}
              {guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  no one&apos;s said they&apos;re going yet.
                </p>
              ) : isHost ? (
                <ArrivalBoard guests={guests} timing={timing} />
              ) : (
                <GuestGrid guests={guests} viewerId={viewerId} />
              )}
            </TabsContent>

            <TabsContent value="updates" className="pt-2 pb-4">
              {canSeeThread ? (
                <EventThreadList
                  thread={thread}
                  hostId={event.hostId}
                  viewerId={viewerId}
                  closedNote={closedNote}
                />
              ) : (
                <EventThreadLocked count={event.updateCount ?? 0} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {hasBar && (
        <div className="fixed inset-x-0 bottom-[var(--sponti-nav-h,64px)] z-30 border-t border-border/60 bg-background/95 px-4 pt-1.5 pb-2 backdrop-blur">
          {composing && canSeeThread && !thread.closedByServer ? (
            <EventThreadComposer
              ref={composerRef}
              thread={thread}
              placeholder={isHost ? "announce to everyone..." : "say something..."}
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

/** Host only: going guests by arrival time, the next arrival highlighted. */
function ArrivalBoard({
  guests,
  timing,
}: {
  guests: NonNullable<HostedEvent["attendees"]>
  timing: FlareTiming
}) {
  // Ticks so "arriving in 5 min" stays true while the host keeps it open.
  const [now, setNow] = useState(0)
  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    updateNow()
    const id = window.setInterval(updateNow, 30_000)
    return () => window.clearInterval(id)
  }, [])
  const arrivalMs = (g: (typeof guests)[number]) =>
    g.willArriveAt ? new Date(g.willArriveAt).getTime() : Number.POSITIVE_INFINITY
  const sorted = [...guests].sort((a, b) => arrivalMs(a) - arrivalMs(b))
  const next = sorted.find((g) => arrivalMs(g) > now && Number.isFinite(arrivalMs(g)))
  const showEtas = etaAvailable(timing)

  return (
    <ul>
      {sorted.map((guest) => {
        const isNext = guest === next
        const runningLate = guest.arrivalStatus === "running_late"
        return (
          <li
            key={guest.id}
            className={cn(
              "flex items-center gap-2.5 py-1.5",
              isNext && "-ml-3 border-l-[3px] border-l-accent pl-2.25"
            )}
          >
            <GuestAvatar guest={guest} className="size-7" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {guest.displayName.toLowerCase()}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs",
                isNext || runningLate ? "font-medium text-accent" : "text-muted-foreground"
              )}
            >
              {!showEtas
                ? "going"
                : guest.willArriveAt
                  ? formatArrivalStatus(guest.willArriveAt, now)
                  : guest.arrivalStatus
                    ? arrivalStatusLabel(guest.arrivalStatus)
                    : "no eta"}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Guests see names only: no ETAs, no +1s. */
function GuestGrid({
  guests,
  viewerId,
}: {
  guests: NonNullable<HostedEvent["attendees"]>
  viewerId?: string
}) {
  return (
    <div className="grid grid-cols-4 gap-y-3">
      {guests.map((guest) => (
        <div key={guest.id} className="flex min-w-0 flex-col items-center gap-1">
          <GuestAvatar guest={guest} className="size-11" />
          <span className="max-w-full truncate text-xs">
            {guest.id === viewerId ? "you" : guest.displayName.split(" ")[0].toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  )
}

function GuestAvatar({
  guest,
  className,
}: {
  guest: NonNullable<HostedEvent["attendees"]>[number]
  className?: string
}) {
  return (
    <Avatar className={className}>
      {guest.avatarUrl && <AvatarImage src={guest.avatarUrl} alt="" />}
      <AvatarFallback className="text-xs">{initials(guest.displayName)}</AvatarFallback>
    </Avatar>
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

function whenLabel(startIso: string, timing: FlareTiming): string {
  if (timing === "live") return `now · ${formatClock(startIso)}`
  return `${formatStartDay(startIso)} · ${formatClock(startIso)}`
}

function formatStartDay(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  if (sameDay) return "today"
  if (isTomorrow) return "tomorrow"
  return d
    .toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toLowerCase()
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const hour = hours % 12 || 12
  const minute = String(minutes).padStart(2, "0")
  const period = hours >= 12 ? "pm" : "am"
  return `${hour}:${minute}${period}`
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
