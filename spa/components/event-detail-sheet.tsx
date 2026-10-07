"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Drawer } from "vaul"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import {
  FlareActions,
  FlareFacts,
  FlareHeader,
} from "@/components/flare-detail"
import {
  CaretRightIcon,
  NavigationArrowIcon,
  PencilSimpleIcon,
  UserIcon,
} from "@/components/icons"
import {
  arrivalStatusLabel,
  avatarText,
  distanceFromUser,
  eventCoords,
  formatArrivalStatus,
  type EventItem,
} from "@/lib/api/events"
import {
  etaAvailable,
  flareStatusLine,
  flareTiming,
  flareViewer,
  googleMapsUrl,
} from "@/lib/flare-detail"
import { readLastKnownCoords } from "@/lib/geolocation"
import { haptic } from "@/lib/haptics"
import { formatDayShort } from "@/lib/format-date"
import { eventDisplayTitle } from "@/lib/flare-title"

interface Props {
  open: boolean
  event: EventItem | null
  joined: boolean
  isHost?: boolean
  onClose: () => void
  onJoin: (event: EventItem, eta: string | null) => void
  onLeave: (event: EventItem) => void
  onSeeRoute: (event: EventItem) => void
}

export function EventDetailSheet({
  open,
  event,
  joined,
  isHost = false,
  onClose,
  onJoin,
  onLeave,
  onSeeRoute,
}: Props) {
  const router = useRouter()
  const [selectedEta, setSelectedEta] = useState<string | null>(null)

  // Keep showing the last non-null event while vaul animates the drawer closed.
  const [displayEvent, setDisplayEvent] = useState<EventItem | null>(event)
  useEffect(() => {
    if (event) {
      // Resets the sheet's local "last shown" state to track the incoming
      // prop; the rule only flags this first setState call in the effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayEvent(event)
      setSelectedEta(null)
    }
  }, [event])

  // Haptic on open
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) haptic("light")
    prevOpen.current = open
  }, [open])

  const { user } = useAuth()
  // Same rules as the full page (#139): who's looking picks the main action,
  // and an arrival time is only asked for when live or starting within 1h.
  const viewer = flareViewer({
    isHost,
    myRsvp: joined ? "going" : displayEvent?.myRsvp,
  })
  const timing = displayEvent
    ? flareTiming({ startAt: displayEvent.startAt, endAt: displayEvent.endAt })
    : "later"
  const withEta = etaAvailable(timing)
  const distance = displayEvent
    ? distanceFromUser(displayEvent, readLastKnownCoords())
    : null

  // The full flare page holds the thread and the host's arrival board. Close
  // the drawer first so vaul's body scroll lock doesn't leak into it (#168).
  const openFlarePage = (query = "") => {
    if (!displayEvent) return
    onClose()
    router.push(`/event/${displayEvent.id}${query}`)
  }

  const hostIsViewer = Boolean(user && displayEvent?.host?.id === user.id)
  const hostLabel = hostIsViewer
    ? "hosted by you"
    : `hosted by ${(displayEvent?.host?.name || "host").toLowerCase()}`
  // Your own row has nowhere to go (your profile page only lists other
  // people), and a host without a username can't be linked.
  const hostProfileHref =
    !hostIsViewer && displayEvent?.host?.username
      ? `/profile/${encodeURIComponent(displayEvent.host.username)}`
      : null

  // A guest links to their profile like the host row does (#265). Your own
  // row and a guest without a username stay plain.
  const guestProfileHref = (a: { id?: string; username?: string }) =>
    a.username && !(user && a.id === user.id)
      ? `/profile/${encodeURIComponent(a.username)}`
      : null

  // The api only sends willArriveAt/arrivalStatus on attendee rows to the
  // flare's host, so this is naturally empty for anyone else — no separate
  // client-side check needed beyond the isHost render guard below.
  const attendeesWithArrival = (displayEvent?.attendees ?? []).filter(
    (a) => a.willArriveAt || a.arrivalStatus
  )

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          haptic("light")
          onClose()
        }
      }}
      dismissible
      // No text inputs in the sheet, and it is pinned to the nav with CSS.
      // Leaving vaul's keyboard repositioning on would let it write its own
      // `bottom` over ours (same as notifications-sheet.tsx).
      repositionInputs={false}
    >
      <Drawer.Portal>
        {/* Docked on the bottom nav like the notifications sheet, so the bell
            stays in view (#419). The scrim stops at the nav's top edge, so
            the nav stays lit and tappable. */}
        <Drawer.Overlay className="fixed inset-x-0 top-0 bottom-[var(--sponti-nav-h,64px)] z-50 bg-foreground/30" />
        {/* The frame ends at the nav's top edge and clips, so the sheet slides
            in and out from behind that edge instead of across the nav. The nav
            already pads for the home indicator, so the sheet adds no inset of
            its own. `after:hidden` turns off vaul's ::after, which extends the
            background 200% below the sheet and would paint over the nav
            (#296/#301). The cap matches the notifications sheet: measured
            against the visible viewport (--sponti-vvh) so the top stays in
            thumb reach on iOS Safari.

            A press on the nav is left as an outside press, unlike in the
            notifications sheet: it dismisses this sheet and the nav item's
            own click still runs, so one tap closes the sheet and goes to the
            tab (or opens the feed). */}
        <div className="pointer-events-none fixed inset-x-0 top-0 bottom-[var(--sponti-nav-h,64px)] z-50 overflow-hidden">
          <Drawer.Content className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[calc(0.7*var(--sponti-vvh,100vh)-var(--sponti-nav-h,64px))] flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) outline-none after:hidden">
            {/* Drag handle — vaul attaches its gesture here automatically */}
            <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            <Drawer.Title className="sr-only">
              {displayEvent
                ? eventDisplayTitle(displayEvent, user?.id)
                : "Flare details"}
            </Drawer.Title>
            <Drawer.Description className="sr-only">
              event details and rsvp
            </Drawer.Description>

            {displayEvent && (
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
                data-vaul-no-drag
              >
                <FlareHeader
                  as="h2"
                  type={displayEvent.type}
                  title={eventDisplayTitle(displayEvent, user?.id)}
                  statusLine={flareStatusLine(displayEvent, timing)}
                  timing={timing}
                  viewer={viewer}
                />

                <div className="my-4">
                  <FlareFacts
                    when={formatWhen(displayEvent.startAt, timing === "live")}
                    until={`until ${formatClock(displayEvent.endAt)}`}
                    placeName={displayEvent.location.name}
                    placeDetail={
                      [
                        distance?.label,
                        displayEvent.location.area ??
                          displayEvent.location.address,
                      ]
                        .filter(Boolean)
                        .join(" · ") || null
                    }
                    mapsUrl={googleMapsUrl({
                      coordinates: eventCoords(displayEvent),
                      name: displayEvent.location.name,
                    })}
                  />
                </div>

                {/* Host: one compact row, a link to their profile (#199). The
                  note, when there is one, sits under the name. */}
                <HostRow
                  href={hostProfileHref}
                  onNavigate={() => onClose()}
                  label={hostLabel}
                  name={displayEvent.host.name}
                  avatarUrl={displayEvent.host.avatarUrl}
                  avatar={displayEvent.host.avatar}
                  color={displayEvent.host.color}
                  note={displayEvent.host.note}
                />

                {/* Who's Going. With nobody yet it is one quiet line instead of
                  a label over an empty row. */}
                <div className="mb-4">
                  {displayEvent.going === 0 &&
                  displayEvent.attendees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      no one going yet
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 text-xs text-muted-foreground">
                        who&apos;s going
                      </p>
                      <div className="flex items-center gap-3">
                        {displayEvent.attendees.length > 0 && (
                          <div className="flex -space-x-2">
                            {displayEvent.attendees.map((a, i) => (
                              <GuestFace
                                key={a.id ?? i}
                                href={guestProfileHref(a)}
                                onNavigate={() => onClose()}
                                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs ${a.color} ${avatarText(a.color)}`}
                              >
                                {a.avatar ||
                                  a.name?.charAt(0).toUpperCase() ||
                                  "U"}
                              </GuestFace>
                            ))}
                          </div>
                        )}
                        <div>
                          {displayEvent.attendees.length > 0 && (
                            <p className="font-medium">
                              {displayEvent.attendees.map((a, i) => {
                                const href = guestProfileHref(a)
                                const name = a.name.toLowerCase()
                                return (
                                  <span key={a.id ?? i}>
                                    {i > 0 && ", "}
                                    {href ? (
                                      <Link
                                        href={href}
                                        onClick={() => onClose()}
                                        aria-label={`${name}, open profile`}
                                        className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:text-muted-foreground"
                                      >
                                        {name}
                                      </Link>
                                    ) : (
                                      name
                                    )}
                                  </span>
                                )
                              })}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {displayEvent.going} going
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Attendee arrival answers — host only; the api only sends
                    willArriveAt/arrivalStatus to the host in the first place. */}
                  {isHost && attendeesWithArrival.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {attendeesWithArrival.map((a, i) => (
                        <div
                          key={a.id ?? i}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <span>{a.name}</span>
                          <span
                            className={
                              a.arrivalStatus === "running_late"
                                ? "font-medium text-accent"
                                : undefined
                            }
                          >
                            {a.willArriveAt
                              ? formatArrivalStatus(a.willArriveAt)
                              : a.arrivalStatus
                                ? arrivalStatusLabel(a.arrivalStatus)
                                : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <FlareActions
                  viewer={viewer}
                  timing={timing}
                  declined={!joined && displayEvent.myRsvp === "declined"}
                  eta={selectedEta}
                  declineInline={false}
                  onEtaChange={(eta) => {
                    haptic("selection")
                    setSelectedEta(eta)
                  }}
                  onJoin={() => {
                    haptic("success")
                    onJoin(displayEvent, withEta ? selectedEta : null)
                  }}
                  onDecline={() => {
                    haptic("warning")
                    onLeave(displayEvent)
                  }}
                  onShareUpdate={() => {
                    haptic("selection")
                    openFlarePage("?tab=updates&compose=1")
                  }}
                />

                {/* Everything after the main action, in one two-column row so
                  the sheet ends on a balanced pair rather than a stack. An odd
                  one out spans the full width. */}
                <div className="mt-3 grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
                  {viewer === "joined" &&
                    withEta &&
                    eventCoords(displayEvent) && (
                      <SecondaryAction
                        onClick={() => {
                          haptic("medium")
                          onSeeRoute(displayEvent)
                        }}
                      >
                        <NavigationArrowIcon className="h-4 w-4" /> see route
                      </SecondaryAction>
                    )}
                  {viewer === "joined" &&
                    timing !== "ended" &&
                    timing !== "cancelled" && (
                      <SecondaryAction
                        onClick={() => {
                          haptic("warning")
                          onLeave(displayEvent)
                        }}
                      >
                        can&apos;t make it
                      </SecondaryAction>
                    )}
                  {viewer === "host" && (
                    <SecondaryAction onClick={() => openFlarePage("/edit")}>
                      <PencilSimpleIcon className="h-4 w-4" /> edit flare
                    </SecondaryAction>
                  )}
                  <SecondaryAction onClick={() => openFlarePage()}>
                    {viewer === "invited"
                      ? "see details and updates"
                      : "open flare"}
                    <CaretRightIcon className="h-4 w-4" />
                  </SecondaryAction>
                </div>
              </div>
            )}
          </Drawer.Content>
        </div>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function SecondaryAction({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    // Neutral, so the peach main action stays the only call to action.
    <Button
      variant="ghost"
      className="h-10 w-full rounded-full bg-muted text-sm text-foreground hover:bg-muted/70"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/**
 * One avatar in the who's-going stack: a profile link, or plain when there's
 * nowhere to go. The guest's name beside the stack is the same link for
 * keyboard and screen-reader users, so the avatar is a tap shortcut only and
 * stays out of the tab order and accessibility tree.
 */
function GuestFace({
  href,
  onNavigate,
  className,
  children,
}: {
  href: string | null
  onNavigate: () => void
  className: string
  children: React.ReactNode
}) {
  if (!href) return <div className={className}>{children}</div>
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-hidden
      tabIndex={-1}
      className={`${className} outline-none`}
    >
      {children}
    </Link>
  )
}

function HostRow({
  href,
  onNavigate,
  label,
  name,
  avatarUrl,
  avatar,
  color,
  note,
}: {
  href: string | null
  onNavigate: () => void
  label: string
  name: string
  avatarUrl?: string | null
  avatar: string
  color: string
  note: string
}) {
  const face = avatarUrl ? (
    // Static export (required for the Capacitor iOS/Android wrapper) can't
    // use next/image's server-side optimizer, and host avatar URLs are
    // arbitrary/remote, so a plain <img> is intentional here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      className="h-7 w-7 shrink-0 rounded-full object-cover"
    />
  ) : (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${color} ${avatarText(color)}`}
    >
      {avatar || name?.charAt(0).toUpperCase() || (
        <UserIcon className="h-4 w-4" />
      )}
    </div>
  )
  const text = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{label}</p>
      {note ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
  const rowClass = "mb-3 flex min-h-11 items-center gap-2.5"

  if (!href) {
    return (
      <div className={rowClass}>
        {face}
        {text}
      </div>
    )
  }
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={`${label}, open profile`}
      className={`${rowClass} rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted`}
    >
      {face}
      {text}
      <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function formatWhen(startIso: string, live: boolean): string {
  const start = new Date(startIso)
  if (live) return `now · ${formatClock(startIso)}`
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const day =
    start.toDateString() === today.toDateString()
      ? "today"
      : start.toDateString() === tomorrow.toDateString()
        ? "tomorrow"
        : formatDayShort(start)
  return `${day} · ${formatClock(startIso)}`
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  const hour = d.getHours() % 12 || 12
  const minute = String(d.getMinutes()).padStart(2, "0")
  return `${hour}:${minute}${d.getHours() >= 12 ? "pm" : "am"}`
}
