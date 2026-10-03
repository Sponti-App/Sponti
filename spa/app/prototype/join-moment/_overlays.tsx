"use client"

// PROTOTYPE (#374) — throwaway. The overlay layer: what the host sees when
// the first friend joins. Three variants share the same moving parts
// (OverlayEls in _timelines.ts) so one controller drives them all:
//   A card   — a card drops in from the top, turns peach, shrinks to a dot
//              and drops into the bell.
//   B arc    — the friend's avatar pops in the middle of the screen, then
//              arcs into the bell leaving a spark trail.
//   C banner — a full-width banner rolls down from the top edge, rolls back
//              up and drops a peach ember into the bell.
// All markup starts invisible; GSAP reveals it.

import { cn } from "@/lib/utils"
import { overlayCopy, type Overlay, type Person, type Shows } from "./_mock"
import { AvatarStack, PersonAvatar } from "./_screens"

export type OverlayRefs = {
  body: HTMLElement | null
  content: HTMLElement | null
  ember: HTMLElement | null
  ring: HTMLElement | null
  anchor: HTMLElement | null
  sparks: (HTMLElement | null)[]
  puffs: (HTMLElement | null)[]
}

/** Ref callback factory: set("body"), or set("sparks", i) for a list. */
export type OverlaySet = (
  key: keyof OverlayRefs,
  index?: number
) => (n: HTMLElement | null) => void

const HIDDEN = { opacity: 0 } as const

export function OverlayLayer({
  overlay,
  people,
  puffs,
  shows,
  started,
  set,
}: {
  overlay: Overlay
  people: Person[]
  puffs: Person[]
  shows: Shows
  started: boolean
  set: OverlaySet
}) {
  const copy = overlayCopy(people, shows, started)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
    >
      {people.length > 0 && overlay === "card" && (
        <div className="absolute inset-x-4 top-3">
          <div
            ref={set("body")}
            style={HIDDEN}
            className="relative overflow-hidden rounded-2xl bg-card p-3 shadow-(--shadow-card) ring-1 ring-border"
          >
            <div ref={set("content")} className="flex items-center gap-3">
              <AvatarStack people={people} size="lg" />
              <div className="min-w-0">
                <p className="text-base font-semibold">{copy.title}</p>
                {copy.detail && (
                  <p className="truncate text-xs text-muted-foreground">
                    {copy.detail}
                  </p>
                )}
              </div>
            </div>
            <div
              ref={set("ember")}
              style={HIDDEN}
              className="absolute inset-0 bg-primary"
            />
          </div>
        </div>
      )}

      {people.length > 0 && overlay === "arc" && (
        <div className="absolute inset-x-6 top-1/4 flex flex-col items-center">
          <div ref={set("body")} style={HIDDEN} className="relative">
            <span
              ref={set("ring")}
              className="absolute inset-0 rounded-full border-2 border-primary opacity-0"
            />
            <span ref={set("anchor")} className="flex">
              {people.length === 1 ? (
                <PersonAvatar
                  person={people[0]}
                  size="xl"
                  className="ring-4 ring-primary"
                />
              ) : (
                <AvatarStack
                  people={people}
                  size="xl"
                  ring="ring-4 ring-background"
                />
              )}
            </span>
          </div>
          <div
            ref={set("content")}
            style={HIDDEN}
            className="mt-3 rounded-xl bg-card px-3 py-2 text-center shadow-(--shadow-card)"
          >
            <p className="text-base font-semibold">{copy.title}</p>
            {copy.detail && (
              <p className="text-xs text-muted-foreground">{copy.detail}</p>
            )}
          </div>
        </div>
      )}

      {people.length > 0 && overlay === "banner" && (
        <div
          ref={set("body")}
          style={HIDDEN}
          className="absolute inset-x-0 top-0 rounded-b-2xl border-b border-border bg-card px-4 pt-3 pb-3 shadow-(--shadow-sheet)"
        >
          <div ref={set("content")} className="flex items-center gap-3">
            <span ref={set("anchor")} className="flex">
              <AvatarStack people={people} size="md" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{copy.title}</p>
              {copy.detail && (
                <p className="truncate text-xs text-muted-foreground">
                  {copy.detail}
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground">now</span>
          </div>
        </div>
      )}

      {/* The banner's falling ember (also positioned by GSAP). */}
      {overlay === "banner" && (
        <span
          ref={set("ember")}
          style={HIDDEN}
          className="absolute top-0 left-0 -mt-1.5 -ml-1.5 size-3 rounded-full bg-primary"
        />
      )}

      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          ref={set("sparks", i)}
          style={HIDDEN}
          className={cn(
            "absolute top-0 left-0 -mt-1 -ml-1 size-2 rounded-full",
            i % 2 ? "bg-chart-1" : "bg-primary"
          )}
        />
      ))}

      {puffs.map((p, i) => (
        <span
          key={p.id}
          ref={set("puffs", i)}
          style={HIDDEN}
          className="absolute top-0 left-0 -mt-3 -ml-3 flex"
        >
          <PersonAvatar person={p} size="xs" className="ring-2 ring-primary" />
        </span>
      ))}
    </div>
  )
}
