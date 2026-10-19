"use client"

// The parts of a flare's detail shared by the flare page and the flare drawer
// (#615): the viewer's rsvp and arrival answers, the host card, and the going
// / updates tabs with the host's arrival board.

import { useEffect, useState } from "react"
import Link from "next/link"
import { CaretRightIcon, LockIcon } from "@/components/icons"
import { useActionFeedback } from "@/components/action-feedback"
import { initials } from "@/components/event-avatar-stack"
import {
  EventThreadList,
  EventThreadLocked,
  type EventThreadState,
} from "@/components/event-thread"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  arrivalStatusLabel,
  etaToIso,
  formatArrivalStatus,
  updateMyRsvp,
  type ArrivalStatus,
  type HostedEvent,
} from "@/lib/api/events"
import {
  etaAvailable,
  etaControlKind,
  spotsLeftLabel,
  type FlareTiming,
  type FlareViewer,
} from "@/lib/flare-detail"
import { HttpError } from "@/lib/http"
import { formatDayShort } from "@/lib/format-date"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"

const TAB_TRIGGER =
  "text-sm data-active:bg-card data-active:text-primary dark:data-active:bg-card dark:data-active:text-primary"

export type FlareTab = "guests" | "updates"

/**
 * The viewer's own answers: join, can't make it, and the arrival time or
 * status they share with the host. Saves through PATCH /events/:id/me and
 * applies the change locally before the refetch.
 */
export function useFlareMembership({
  event,
  timing,
  viewerId,
  onEventChange,
  onReload,
}: {
  event: HostedEvent
  timing: FlareTiming
  viewerId?: string
  onEventChange: (
    update: (current: HostedEvent | null) => HostedEvent | null
  ) => void
  onReload: () => void
}) {
  const { showActionFeedback } = useActionFeedback()
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
        setRsvpError(
          err instanceof Error ? err.message : "could not update rsvp"
        )
        showActionFeedback("couldn't save that", { tone: "error" })
      }
    } finally {
      setSaving(false)
    }
  }

  const join = () => {
    const kind = etaControlKind(timing)
    const willArriveAt = kind === "minutes" ? etaToIso(eta) : null
    const arrivalStatus =
      kind === "status" ? (eta as ArrivalStatus | null) : null
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
          current.myRsvp === "going"
            ? current.attendingCount
            : current.attendingCount + 1,
      })
    )
  }
  const decline = () =>
    void saveMembership(
      { rsvpStatus: "declined" },
      "not this one",
      (current) => ({
        ...current,
        myRsvp: "declined",
        myWillArriveAt: null,
        myArrivalStatus: null,
        attendingCount:
          current.myRsvp === "going"
            ? Math.max(0, current.attendingCount - 1)
            : current.attendingCount,
        attendees: (current.attendees ?? []).filter((a) => a.id !== viewerId),
      })
    )
  // Sets a new answer, of whichever kind the current timing offers.
  const changeEta = (choice: string) => {
    setEta(choice)
    setEditingEta(false)
    if (etaControlKind(timing) === "status") {
      const arrivalStatus = choice as ArrivalStatus
      void saveMembership({ arrivalStatus }, "host knows", (current) => ({
        ...current,
        myArrivalStatus: arrivalStatus,
        myWillArriveAt: null,
      }))
      return
    }
    const willArriveAt = etaToIso(choice)
    void saveMembership(
      { memberWillArriveAt: willArriveAt },
      willArriveAt ? "host knows" : "eta cleared",
      (current) => ({
        ...current,
        myWillArriveAt: willArriveAt,
        myArrivalStatus: null,
      })
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

  return {
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
  }
}

/** Going / updates, as tabs. The host sees the arrival board. */
export function FlareGuestsAndUpdates({
  event,
  viewer,
  viewerId,
  timing,
  thread,
  tab,
  onTabChange,
  className,
}: {
  event: HostedEvent
  viewer: FlareViewer
  viewerId?: string
  timing: FlareTiming
  thread: EventThreadState
  tab: FlareTab
  onTabChange: (tab: FlareTab) => void
  className?: string
}) {
  const isHost = viewer === "host"
  const canSeeThread = viewer !== "invited"
  const guests = event.attendees ?? []
  const spots = spotsLeftLabel({
    visibility: event.visibility,
    guestLimit: event.guestLimit,
    // +1s count towards the limit once #159 ships them; until then it's people.
    headcount: event.attendingCount,
    allowGuestInvites: event.allowGuestInvites,
  })
  const updateCount =
    canSeeThread && !thread.loading
      ? thread.updates.length
      : (event.updateCount ?? 0)
  const closedNote =
    timing === "cancelled"
      ? "this flare was cancelled · the thread is read-only"
      : timing === "ended"
        ? "this flare has ended · the thread is read-only"
        : null

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => onTabChange(next as FlareTab)}
      className={className}
    >
      <TabsList className="h-9 w-full">
        <TabsTrigger value="guests" className={TAB_TRIGGER}>
          {event.attendingCount} going
        </TabsTrigger>
        <TabsTrigger value="updates" className={TAB_TRIGGER}>
          {!canSeeThread && <LockIcon className="h-3 w-3" />}
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
          <ArrivalBoard guests={guests} timing={timing} viewerId={viewerId} />
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
  )
}

/**
 * The host: links to their profile (#199), like the sheet's host row. Not for
 * your own flare, or a host the api sent without a username.
 */
export function FlareHost({
  event,
  isHost,
}: {
  event: HostedEvent
  isHost: boolean
}) {
  const hostName = flareHostName(event)
  const category = EVENT_TYPES.find((t) => t.value === event.type)?.label
  return (
    <HostCard
      href={
        !isHost && event.hostUsername
          ? `/profile/${encodeURIComponent(event.hostUsername)}`
          : null
      }
    >
      <Avatar className="size-7">
        {event.hostAvatarUrl && (
          <AvatarImage src={event.hostAvatarUrl} alt="" />
        )}
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
    </HostCard>
  )
}

/** The host's name as the flare shows it, lowercase. */
export function flareHostName(event: HostedEvent): string {
  return (event.hostName ?? event.hostUsername ?? "host").toLowerCase()
}

export function HostCard({
  href,
  children,
}: {
  href: string | null
  children: React.ReactNode
}) {
  const className = "mt-4 flex items-start gap-2.5 rounded-xl bg-muted p-3"
  if (!href) return <div className={className}>{children}</div>
  return (
    <Link
      href={href}
      className={cn(
        className,
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/70"
      )}
    >
      {children}
      <CaretRightIcon className="ml-auto h-4 w-4 shrink-0 self-center text-muted-foreground" />
    </Link>
  )
}

/** Host only: going guests by arrival time, the next arrival highlighted. */
export function ArrivalBoard({
  guests,
  timing,
  viewerId,
}: {
  guests: NonNullable<HostedEvent["attendees"]>
  timing: FlareTiming
  viewerId?: string
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
    g.willArriveAt
      ? new Date(g.willArriveAt).getTime()
      : Number.POSITIVE_INFINITY
  const sorted = [...guests].sort((a, b) => arrivalMs(a) - arrivalMs(b))
  const next = sorted.find(
    (g) => arrivalMs(g) > now && Number.isFinite(arrivalMs(g))
  )
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
            {/* Avatar + name are the profile link; the ETA stays outside it. */}
            <GuestLink
              guest={guest}
              viewerId={viewerId}
              className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5"
            >
              <GuestAvatar guest={guest} className="size-7" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {guest.displayName.toLowerCase()}
              </span>
            </GuestLink>
            <span
              className={cn(
                "shrink-0 text-xs",
                isNext || runningLate
                  ? "font-medium text-accent-ink"
                  : "text-muted-foreground"
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
export function GuestGrid({
  guests,
  viewerId,
}: {
  guests: NonNullable<HostedEvent["attendees"]>
  viewerId?: string
}) {
  return (
    <div className="grid grid-cols-4 gap-y-3">
      {guests.map((guest) => (
        <GuestLink
          key={guest.id}
          guest={guest}
          viewerId={viewerId}
          className="flex min-w-0 flex-col items-center gap-1"
        >
          <GuestAvatar guest={guest} className="size-11" />
          <span className="max-w-full truncate text-xs">
            {guest.id === viewerId
              ? "you"
              : guest.displayName.split(" ")[0].toLowerCase()}
          </span>
        </GuestLink>
      ))}
    </div>
  )
}

/**
 * A guest's avatar and name as a link to their profile (#265), like the host
 * card. Your own row and a guest the api sent without a username stay plain,
 * non-interactive markup.
 */
export function GuestLink({
  guest,
  viewerId,
  className,
  children,
}: {
  guest: NonNullable<HostedEvent["attendees"]>[number]
  viewerId?: string
  className?: string
  children: React.ReactNode
}) {
  if (!guest.username || guest.id === viewerId) {
    return <div className={className}>{children}</div>
  }
  return (
    <Link
      href={`/profile/${encodeURIComponent(guest.username)}`}
      aria-label={`${guest.displayName.toLowerCase()}, open profile`}
      className={cn(
        className,
        "rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
      )}
    >
      {children}
    </Link>
  )
}

export function GuestAvatar({
  guest,
  className,
}: {
  guest: NonNullable<HostedEvent["attendees"]>[number]
  className?: string
}) {
  return (
    <Avatar className={className}>
      {guest.avatarUrl && <AvatarImage src={guest.avatarUrl} alt="" />}
      <AvatarFallback className="text-xs">
        {initials(guest.displayName)}
      </AvatarFallback>
    </Avatar>
  )
}

export function whenLabel(startIso: string, timing: FlareTiming): string {
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
  return formatDayShort(d)
}

export function formatClock(iso: string): string {
  const d = new Date(iso)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const hour = hours % 12 || 12
  const minute = String(minutes).padStart(2, "0")
  const period = hours >= 12 ? "pm" : "am"
  return `${hour}:${minute}${period}`
}
