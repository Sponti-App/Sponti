"use client"

// #522 (behind `quietHome`): what the home map's sheet shows when there are
// no flares. Picked from the #523 prototype ("combined", round 3), reworked
// in #561 and #562:
//   - the people you recently connected with, compact, after a fresh sign-in
//     (lib/quiet-home.ts), with "group" into a circle and swipe to hide;
//   - a 0-friend account: empty slots and one invite button;
//   - two flare cards, right now and soon (signed in);
//   - a signed-out visitor: the value prop and nearby idea cards.
// Each block has two text styles at most, no card sits inside a card, and
// nothing here is peach: the nav's flare button is the screen's one call to
// action (BRAND.md).

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  CalendarBlankIcon,
  FlameIcon,
  PlusIcon,
  UserPlusIcon,
  UsersIcon,
} from "@/components/icons"
import { IdeaIcon } from "@/components/idea-icon"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/components/event-avatar-stack"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import { formatDistance, haversineMeters } from "@/lib/api/events"
import type { Connection } from "@/lib/circles"
import type { Idea } from "@/lib/flare-ideas-anywhere"
import type { GeoCoords } from "@/lib/geolocation"
import { haptic } from "@/lib/haptics"
import { subscribeToFriendsChanged } from "@/lib/onboarding-checklist"
import {
  batchPeople,
  dismissRecentPeople,
  readRecentPeopleState,
  settleRecentPeople,
  useRecentPeopleState,
  writeRecentPeopleState,
  type RecentPeopleState,
} from "@/lib/quiet-home"
import { useSwipeActions } from "@/lib/use-swipe-actions"
import { cn } from "@/lib/utils"

const PANEL =
  "pointer-events-auto mx-3 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-(--shadow-card) backdrop-blur-md"

const ROUND_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full active:scale-95"

/** The accepted connections, refetched when a friend is added. Null until
 * the first answer (and after a failed one: the sheet then shows no
 * people block rather than a wrong "no friends yet"). */
export function useQuietPeople(enabled: boolean): Connection[] | null {
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeToFriendsChanged(() => setTick((n) => n + 1)), [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchAcceptedConnections(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setConnections(next)
      })
      .catch(() => {
        // Keep what we had; the sheet shows no people block.
      })
    return () => controller.abort()
  }, [enabled, tick])
  return connections
}

/**
 * #561: the people you recently connected with, compact: one line of
 * avatars and first names (each opens that profile) and one action, "group",
 * that opens the circles page with them ticked. Swipe it sideways to hide it;
 * the caller offers undo.
 */
/**
 * #561: who the "recently connected" card shows, by the fresh-sign-in rule
 * in lib/quiet-home.ts. `active` is true while the quiet home is on screen:
 * that's when a fresh sign-in is used up (shown or lapsed).
 */
export function useRecentPeople({
  connections,
  userId,
  now,
  active,
}: {
  connections: Connection[] | null
  userId: string | null
  now: number
  active: boolean
}): {
  people: Connection[]
  dismiss: () => RecentPeopleState
  restore: (state: RecentPeopleState) => void
} {
  const state = useRecentPeopleState()
  useEffect(() => {
    if (!active || !connections || !userId || now <= 0) return
    const current = readRecentPeopleState()
    const next = settleRecentPeople(current, userId, connections, now)
    if (next !== current) writeRecentPeopleState(next)
  }, [active, connections, userId, now])
  return {
    people: connections ? batchPeople(state, userId, connections) : [],
    dismiss: () => dismissRecentPeople(Date.now()),
    restore: writeRecentPeopleState,
  }
}

export function RecentPeopleCard({
  people,
  onGroup,
  onDismiss,
}: {
  people: Connection[]
  onGroup: () => void
  onDismiss: () => void
}) {
  const swipe = useSwipeActions({ onSwipeLeft: onDismiss })
  return (
    <section
      data-quiet-people
      aria-label="you recently connected"
      style={{ ...swipe.style, opacity: swipeOpacity(swipe.offset) }}
      {...swipe.handlers}
      className={cn(PANEL, "py-3 select-none")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">you recently connected</p>
        {/* Swipe is the fast path; this is the one a screen reader finds. */}
        <button
          type="button"
          onClick={onDismiss}
          className="sr-only focus-visible:not-sr-only focus-visible:text-xs"
        >
          hide
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ul className="flex min-w-0 flex-1 items-center gap-3">
          {people.map((person) => (
            <li key={person.id} className="min-w-0">
              <Link
                href={`/profile/${encodeURIComponent(person.username)}`}
                aria-label={person.displayName}
                draggable={false}
                className="flex min-w-0 items-center gap-1.5 rounded-full active:opacity-70"
              >
                <Avatar className="size-8 shrink-0">
                  {person.avatarUrl && (
                    <AvatarImage src={person.avatarUrl} alt="" />
                  )}
                  <AvatarFallback className="bg-muted text-xs text-foreground">
                    {initials(person.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-semibold">
                  {firstName(person.displayName)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-label="group into a circle"
          onClick={() => {
            haptic("selection")
            onGroup()
          }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-semibold active:scale-95"
        >
          <UsersIcon className="size-4" />
          group
        </button>
      </div>
    </section>
  )
}

/** Fades as it travels, so a swipe reads as "away". */
function swipeOpacity(offset: number): number | undefined {
  if (offset >= 0) return undefined
  return Math.max(0.3, 1 + offset / 320)
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName
}

/** A 0-friend account: the empty slots are the placeholder, one invite. */
export function NoFriendsPanel({ onInvite }: { onInvite: () => void }) {
  return (
    <section
      data-quiet-no-friends
      className={cn(PANEL, "flex items-center gap-3")}
    >
      <div aria-hidden="true" className="flex -space-x-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-11 rounded-full border border-dashed border-muted-foreground/60 bg-background"
          />
        ))}
      </div>
      <p className="min-w-0 flex-1 text-sm font-semibold">
        sponti works with your people
      </p>
      <button
        type="button"
        aria-label="invite a friend"
        onClick={() => {
          haptic("selection")
          onInvite()
        }}
        className={cn(ROUND_BUTTON, "bg-foreground text-background")}
      >
        <UserPlusIcon className="size-5" />
      </button>
    </section>
  )
}

/** A signed-out visitor's line: what sponti is for. */
export function ValuePropPanel() {
  return (
    <section data-quiet-value-prop className={PANEL}>
      <p className="text-base font-semibold">less coordinating. more living.</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        check out the flare ideas we&apos;ve got for you, or just light one up!
      </p>
    </section>
  )
}

/** Up to three ideas: the nearest spots first, then place-less ones. */
export function pickQuietIdeas(
  spots: readonly Idea[],
  floating: readonly Idea[],
  center: GeoCoords | null
): Idea[] {
  const near = center
    ? [...spots].sort(
        (a, b) =>
          (a.place ? haversineMeters(center, a.place) : Infinity) -
          (b.place ? haversineMeters(center, b.place) : Infinity)
      )
    : [...spots]
  return [...near, ...floating].slice(0, 3)
}

/** The idea cards: their own cards on the map, one tap lights one. */
export function QuietIdeaCards({
  ideas,
  center,
  onLight,
}: {
  ideas: Idea[]
  center: GeoCoords | null
  onLight: (idea: Idea) => void
}) {
  if (ideas.length === 0) return null
  return (
    <div
      role="region"
      aria-label="flare ideas"
      className="scrollbar-none pointer-events-auto flex touch-pan-x snap-x scroll-px-3 gap-2 overflow-x-auto px-3"
    >
      {ideas.map((idea) => (
        <button
          key={idea.id}
          type="button"
          data-quiet-idea={idea.id}
          aria-label={`light a flare: ${idea.title}`}
          onClick={() => {
            haptic("medium")
            onLight(idea)
          }}
          className="flex w-44 shrink-0 snap-start flex-col rounded-2xl border border-border/60 bg-background/90 p-3 text-left shadow-(--shadow-card) backdrop-blur-md active:scale-[0.98]"
        >
          <span className="flex w-full items-start justify-between">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent-ink">
              <IdeaIcon idea={idea} className="size-5" />
            </span>
            {/* A light disc: the card itself is the button. */}
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground"
            >
              <PlusIcon className="size-3.5" />
            </span>
          </span>
          <span className="mt-3 line-clamp-2 text-sm leading-snug font-semibold">
            {idea.title}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {idea.place && center
              ? formatDistance(haversineMeters(center, idea.place))
              : "anywhere"}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * #562: the quiet home's two ways to light a flare, in place of the idea
 * cards: right now (to close friends) and soon (a time, to the inner
 * circle). Each opens the composer with that mode and circle suggested.
 */
export function FlareCtaCards({
  onRightNow,
  onSoon,
}: {
  onRightNow: () => void
  onSoon: () => void
}) {
  const ctas = [
    {
      id: "now",
      icon: FlameIcon,
      title: "what are you up for right now?",
      line: "let your close friends know…",
      onClick: onRightNow,
    },
    {
      id: "soon",
      icon: CalendarBlankIcon,
      title: "got a plan for soon?",
      line: "pick a time and invite your inner circle",
      onClick: onSoon,
    },
  ] as const
  return (
    <div
      role="region"
      aria-label="light a flare"
      className="pointer-events-auto mx-3 grid grid-cols-2 gap-2"
    >
      {ctas.map(({ id, icon: Icon, title, line, onClick }) => (
        <button
          key={id}
          type="button"
          data-quiet-cta={id}
          onClick={() => {
            haptic("medium")
            onClick()
          }}
          className="flex flex-col rounded-2xl border border-border/60 bg-background/90 p-3 text-left shadow-(--shadow-card) backdrop-blur-md active:scale-[0.98]"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
            <Icon className="size-5" />
          </span>
          <span className="mt-3 text-sm leading-snug font-semibold">
            {title}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{line}</span>
        </button>
      ))}
    </div>
  )
}
