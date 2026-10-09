"use client"

// #522 (behind `quietHome`): what the home map's sheet shows when there are
// no flares. Picked from the #523 prototype ("combined", round 3):
//   - the people you recently connected with, each one tap from a flare with
//     them (a private flare to just that person);
//   - a 0-friend account: empty slots and one invite button;
//   - a signed-out visitor: the value prop;
//   - nearby ideas as their own cards, one tap to light one.
// Each block has two text styles at most, no card sits inside a card, and
// nothing here is peach: the nav's flare button is the screen's one call to
// action (BRAND.md).

import { useEffect, useState } from "react"
import { FlameIcon, PlusIcon, UserPlusIcon } from "@/components/icons"
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
import { connectedAgo } from "@/lib/quiet-home"
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
        // Keep what we had; the sheet falls back to the idea cards.
      })
    return () => controller.abort()
  }, [enabled, tick])
  return connections
}

export function RecentPeoplePanel({
  people,
  now,
  onFlareWith,
}: {
  people: Connection[]
  now: number
  onFlareWith: (person: Connection) => void
}) {
  return (
    <section
      data-quiet-people
      aria-label="you recently connected"
      className={cn(PANEL, "py-3")}
    >
      <p className="text-xs text-muted-foreground">you recently connected</p>
      <ul className="mt-1 divide-y divide-border/60">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 py-2">
            <Avatar className="size-11">
              {person.avatarUrl && (
                <AvatarImage src={person.avatarUrl} alt="" />
              )}
              <AvatarFallback className="bg-accent/10 text-sm text-accent-ink">
                {initials(person.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {person.displayName}
              </p>
              {person.connectedAt && (
                <p className="text-xs text-muted-foreground">
                  {connectedAgo(person.connectedAt, now)}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label={`light a flare with ${person.displayName}`}
              onClick={() => {
                haptic("medium")
                onFlareWith(person)
              }}
              className={cn(ROUND_BUTTON, "border border-border bg-background")}
            >
              <FlameIcon className="size-5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
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
