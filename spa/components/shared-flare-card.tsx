"use client"

// A shared flare link (`/?flare=<id>`) on the signed-out map: the card for
// the flare the link points at, open over the dock. It shows the title, the
// category and when; who's hosting and who's going need an account. Joining
// asks for one, after which the visitor lands on the flare.

import { MapPinIcon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { isLive } from "@/lib/api/events"
import type { PublicMapPin } from "@/lib/api/public-map"
import { formatClock, formatWeekdayClock } from "@/lib/format-date"
import { EVENT_TYPES } from "@/types/utils"

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

/** "live now · until 9:00 pm", "starts 8:00 pm" or "starts sat 8:00 pm". */
export function sharedFlareWhen(pin: PublicMapPin, now: number): string {
  if (isLive(pin, now)) return `live now · until ${formatClock(pin.endAt)}`
  const start = new Date(pin.startAt)
  return sameDay(start, new Date(now))
    ? `starts ${formatClock(start)}`
    : `starts ${formatWeekdayClock(start)}`
}

export function SharedFlareCard({
  pin,
  title,
  now,
  onJoin,
  onDismiss,
}: {
  pin: PublicMapPin
  /** The host's title; empty falls back to the category. */
  title: string
  now: number
  onJoin: () => void
  onDismiss: () => void
}) {
  const type = EVENT_TYPES.find((t) => t.value === pin.type)
  const Icon = type?.icon ?? MapPinIcon
  return (
    <div
      data-shared-flare={pin.id}
      className="pointer-events-auto mx-3 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-(--shadow-card)"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-base font-semibold">
            {title.trim() || `${type?.label ?? "a"} flare`}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[type?.label, "open to all", now > 0 && sharedFlareWhen(pin, now)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="close flare"
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <Button
        type="button"
        onClick={onJoin}
        className="h-11 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
      >
        see who&apos;s going and join
      </Button>
    </div>
  )
}

/** The link pointed at a flare the map can't show. */
export function SharedFlareGoneCard({
  onDismiss,
  signInHref,
}: {
  onDismiss: () => void
  signInHref: string
}) {
  return (
    <div
      data-shared-flare="gone"
      className="pointer-events-auto mx-3 flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-(--shadow-card)"
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">this flare isn&apos;t open</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          it&apos;s over, or only for friends.{" "}
          <a href={signInHref} className="font-medium text-accent-ink">
            sign in
          </a>{" "}
          to check, or look around.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="close"
        className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
