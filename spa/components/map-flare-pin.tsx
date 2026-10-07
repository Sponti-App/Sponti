"use client"

// Flare pins and the pin popover on the map (#315, option B: colour-led).
//
// Every flare pin is the same circle with its category icon, filled by who
// can join: plum for invite only, teal for open to all (the --flare-invite /
// --flare-open tokens in globals.css). Peach on a pin means live and nothing
// else: a peach ring, a pulse and a "live" chip. The host is never on the
// pin. Only the popover names the host, and neither shows circle names or
// attendees, just the going count.

import type { ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/components/event-avatar-stack"
import {
  CaretRightIcon,
  CheckIcon,
  MapPinIcon,
  XIcon,
} from "@/components/icons"
import {
  distanceFromUser,
  isLive,
  type EventItem,
  type EventVisibility,
} from "@/lib/api/events"
import { displayFlareTitle } from "@/lib/flare-title"
import type { GeoCoords } from "@/lib/geolocation"
import { EVENT_TYPES } from "@/types/utils"

const MIN = 60_000

export const VISIBILITY_LABEL: Record<EventVisibility, string> = {
  private: "invite only",
  public: "open to all",
}

// Full class names so Tailwind sees them.
const VISIBILITY_FILL: Record<EventVisibility, string> = {
  private: "bg-flare-invite text-flare-invite-ink",
  public: "bg-flare-open text-flare-open-ink",
}

/**
 * A flare's title as the pin's label and popover show it. `own` is the
 * viewer hosting it: a flare its host left untitled reads "theater outing"
 * to them and "theater outing with lukas" to everyone else (#494).
 */
export function flareTitle(event: EventItem, own = false): string {
  return displayFlareTitle({
    title: event.title,
    type: event.type,
    hostName: event.host.name,
    isHost: own,
  })
}

/** What a pin needs to draw: the signed-out map's public pins (#389) carry
 * no more than this. */
export type FlarePinEvent = Pick<
  EventItem,
  "id" | "type" | "visibility" | "startAt" | "endAt"
>

function categoryOf(event: Pick<EventItem, "type">) {
  const match = EVENT_TYPES.find((t) => t.value === event.type)
  return { label: match?.label ?? event.type, Icon: match?.icon ?? MapPinIcon }
}

/**
 * A short, lowercase clock time for a pin: "7pm", "7:30pm", or "19:00" where
 * the locale uses a 24-hour clock.
 */
export function pinClock(value: string | number | Date): string {
  const text = new Date(value)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
  if (!/[ap]\.?m\.?$/.test(text)) return text
  return text.replace(":00", "").replace(/\s+/g, "")
}

/** "40 min", "1h 10m" or "2h". */
export function timeLeftLabel(ms: number): string {
  const mins = Math.max(0, Math.round(ms / MIN))
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`
}

type Timing = "live" | "soon" | "ended"

function timingOf(
  event: Pick<EventItem, "startAt" | "endAt">,
  now: number
): Timing {
  if (isLive(event, now)) return "live"
  return new Date(event.startAt).getTime() > now ? "soon" : "ended"
}

/** The chip under a pin: "live", "7pm", with "you · " on your own flare. */
export function pinChipLabel(
  event: Pick<EventItem, "startAt" | "endAt">,
  own: boolean,
  now: number = Date.now()
): string {
  const timing = timingOf(event, now)
  const label =
    timing === "live"
      ? "live"
      : timing === "soon"
        ? pinClock(event.startAt)
        : "ended"
  return own ? `you · ${label}` : label
}

/** The popover's time line: "live · ends in 1h 10m" or "starts 7pm". */
export function popoverTimeLabel(
  event: EventItem,
  now: number = Date.now()
): string {
  const timing = timingOf(event, now)
  if (timing === "live") {
    const left = new Date(event.endAt).getTime() - now
    return `live · ends in ${timeLeftLabel(left)}`
  }
  if (timing === "ended") return "ended"
  const start = new Date(event.startAt)
  const sameDay = start.toDateString() === new Date(now).toDateString()
  return sameDay
    ? `starts ${pinClock(start)}`
    : `starts tomorrow ${pinClock(start)}`
}

function LiveDot() {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
    />
  )
}

/** One flare on the map: the circle, its badges and the chip under it. */
export function FlarePin({
  event,
  own,
  joined,
  highlighted = false,
  now,
}: {
  event: FlarePinEvent
  own: boolean
  joined: boolean
  /** The flare whose rail card is centred; its pin grows. */
  highlighted?: boolean
  /** The map's clock, in ms. */
  now: number
}) {
  const live = timingOf(event, now) === "live"
  const { Icon } = categoryOf(event)
  return (
    <div
      data-flare-pin={event.id}
      data-visibility={event.visibility}
      data-live={live ? "true" : "false"}
      className="flex cursor-pointer flex-col items-center"
    >
      <div
        className={`relative transition-transform duration-200 ${
          highlighted ? "scale-125" : ""
        }`}
      >
        {live && (
          <span
            aria-hidden="true"
            className="animate-pulse-ring absolute inset-0 rounded-full bg-accent"
          />
        )}
        <div
          data-pin-circle
          className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-card shadow-lg ${
            VISIBILITY_FILL[event.visibility]
          } ${live ? "ring-2 ring-accent" : ""}`}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        {joined && (
          <span
            data-joined-badge
            role="img"
            aria-label="you're going"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-foreground text-background"
          >
            <CheckIcon aria-hidden="true" weight="bold" className="h-3 w-3" />
          </span>
        )}
      </div>
      <span
        data-pin-chip
        className={`mt-1 flex items-center gap-1 rounded-full bg-card px-1.5 text-xs leading-5 whitespace-nowrap shadow ${
          live ? "font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        {live && <LiveDot />}
        {pinChipLabel(event, own, now)}
      </span>
    </div>
  )
}

/**
 * The popover card over a tapped pin. The band is tinted by who can join and
 * shows the category as its icon only (the word is its accessible name). The
 * close button sits in the band, centred on it and flush with its right edge.
 * There is no peach here: the nav's flare button is already peach.
 *
 * On the Google map the whole card is the marker's click target, so "see
 * flare" is only drawn there (`onSeeFlare` unset). On the static fallback,
 * where the card is plain DOM, "see flare" is a real button.
 */
export function FlarePreviewCard({
  event,
  own,
  user,
  now,
  onClose,
  onClosePressed,
  onSeeFlare,
}: {
  event: EventItem
  own: boolean
  /** The viewer's position, for the distance. */
  user: GeoCoords | null
  /** The map's clock, in ms. */
  now: number
  onClose: () => void
  /** A press started on close (see FlarePreviewMarker). */
  onClosePressed?: () => void
  onSeeFlare?: () => void
}) {
  const { Icon, label } = categoryOf(event)
  const live = timingOf(event, now) === "live"
  const distance = distanceFromUser(event, user)?.label
  const hostFirst = own ? "you" : event.host.name.trim().split(/\s+/)[0]
  const meta = [`by ${hostFirst}`, distance, `${event.going} going`]
    .filter(Boolean)
    .join(" · ")
  const seeFlareClass =
    "mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-muted text-sm font-medium text-foreground"
  const seeFlare: ReactNode = (
    <>
      see flare
      <CaretRightIcon aria-hidden="true" className="h-4 w-4" />
    </>
  )
  return (
    <div className="w-62 overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-xl">
      <div
        data-popover-band
        className={`flex h-10 items-center pl-3 text-xs font-medium ${
          VISIBILITY_FILL[event.visibility]
        }`}
      >
        <span role="img" aria-label={label} className="flex">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span aria-hidden="true" className="mx-1.5 opacity-60">
          ·
        </span>
        <span>{VISIBILITY_LABEL[event.visibility]}</span>
        <button
          type="button"
          aria-label="close"
          onPointerDown={(e) => {
            e.stopPropagation()
            onClosePressed?.()
          }}
          onClick={(e) => {
            // A mouse or keyboard click can reach the card or the marker too.
            e.stopPropagation()
            onClosePressed?.()
            onClose()
          }}
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-tr-2xl hover:bg-foreground/5"
        >
          <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {flareTitle(event, own)}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
          {live && <LiveDot />}
          {popoverTimeLabel(event, now)}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar size="sm">
            {event.host.avatarUrl && (
              <AvatarImage src={event.host.avatarUrl} alt="" />
            )}
            <AvatarFallback className="text-xs">
              {initials(event.host.name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate">{meta}</span>
        </div>
        {onSeeFlare ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSeeFlare()
            }}
            className={seeFlareClass}
          >
            {seeFlare}
          </button>
        ) : (
          <span aria-hidden="true" className={seeFlareClass}>
            {seeFlare}
          </span>
        )}
      </div>
    </div>
  )
}
