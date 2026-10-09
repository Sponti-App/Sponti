"use client"

// PROTOTYPE (#522), throwaway. Take 2, "wildcard": no sheet. The map is the
// canvas. A bubble over your own dot asks "what's the move?", and two rows
// of big tap targets float on a scrim over the nav: who (your people, the
// newest first) and what (activities, each in its own colour). Every tap
// rewrites the bubble ("drinks with mia"), and the nav's flame lights it.
// Almost no copy: the bubble is the only sentence on the screen.
//
// Open questions it raises (not BRAND.md yet): a colour per activity, and
// a scrim instead of a card for the bottom zone.

import { useState } from "react"
import { CaretDownIcon, CheckIcon, UserPlusIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import {
  avatarStyle,
  FauxMap,
  FlareRail,
  FRIENDS,
  TopBar,
  typeOf,
  type VariantProps,
} from "./_shared"

/** The activities, each with a hue for its tint. */
const MOVES = [
  { type: "drinks", hue: 315 },
  { type: "food", hue: 85 },
  { type: "sports", hue: 185 },
  { type: "culture", hue: 140 },
  { type: "hangout", hue: 260 },
] as const

function tint(hue: number) {
  return {
    backgroundColor: `oklch(0.9 0.06 ${hue})`,
    color: `oklch(0.36 0.1 ${hue})`,
  }
}

/** Your dot, the pulse around it, and the bubble above it. */
function Signal({
  people,
  move,
}: {
  people: string[]
  move: (typeof MOVES)[number] | null
}) {
  const composed = move !== null || people.length > 0
  const Icon = move ? typeOf(move.type).icon : null
  const what = move ? typeOf(move.type).label : "something"
  const label = composed
    ? people.length > 0
      ? `${what} with ${people.join(" & ")}`
      : `${what}, open to friends`
    : "what's the move?"

  return (
    // Centred on the faux map's dot (top 45%, left 48%, 16px).
    <div className="pointer-events-none absolute top-[calc(45%+8px)] left-[calc(48%+8px)] z-10">
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 0.9}s` }}
          className={cn(
            "animate-pulse-ring absolute -top-12 -left-12 size-24 rounded-full motion-reduce:hidden",
            composed ? "bg-accent/40" : "bg-[oklch(0.6_0.18_255/0.25)]"
          )}
        />
      ))}
      <div
        key={label}
        className="absolute bottom-6 left-0 flex -translate-x-1/2 animate-in items-center gap-2 rounded-full bg-card py-2 pr-4 pl-2 whitespace-nowrap shadow-lg duration-300 zoom-in-90 fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
      >
        {Icon && move ? (
          <span
            style={tint(move.hue)}
            className="flex size-8 items-center justify-center rounded-full"
          >
            <Icon className="size-4" />
          </span>
        ) : (
          <span className="size-2" />
        )}
        <span className="text-base font-semibold">{label}</span>
        <span className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-card" />
      </div>
    </div>
  )
}

function PersonButton({
  name,
  hue,
  isNew,
  selected,
  onToggle,
}: {
  name: string
  hue: number
  isNew: boolean
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
    >
      <span className="relative">
        <span
          style={avatarStyle(hue)}
          className={cn(
            "flex size-14 items-center justify-center rounded-full text-base font-semibold transition-transform duration-200 active:scale-95",
            selected &&
              "scale-105 ring-2 ring-foreground ring-offset-2 ring-offset-background"
          )}
        >
          {name.slice(0, 2)}
        </span>
        {selected ? (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
            <CheckIcon className="size-3" />
          </span>
        ) : (
          isNew && (
            <span className="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-background bg-accent" />
          )
        )}
      </span>
      <span className="text-xs font-medium">{name}</span>
    </button>
  )
}

/** Before there are people: placeholders, the first one adds someone. */
function EmptyPeople({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <>
      <button
        type="button"
        onClick={onAdd}
        className="flex w-16 shrink-0 flex-col items-center gap-1"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-foreground text-background active:scale-95">
          <UserPlusIcon className="size-5" />
        </span>
        <span className="text-xs font-medium">{label}</span>
      </button>
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex w-16 shrink-0 justify-center">
          <span className="size-14 rounded-full border border-dashed border-muted-foreground/50" />
        </span>
      ))}
    </>
  )
}

export function Wildcard(props: VariantProps) {
  const { viewer, flares, picked, onStub } = props
  const hasPeople = viewer === "friends"
  const [people, setPeople] = useState<string[]>(
    picked && hasPeople ? ["mia"] : []
  )
  const [moveType, setMoveType] = useState<string | null>(
    picked ? "drinks" : null
  )
  const move = MOVES.find((m) => m.type === moveType) ?? null
  const composed = move !== null || people.length > 0

  const togglePerson = (name: string) =>
    setPeople((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <FauxMap flares={flares} />
      <TopBar viewer={viewer} />
      {flares === "0" && <Signal people={people} move={move} />}

      <div
        style={{ bottom: "var(--sponti-nav-h, 64px)" }}
        className="fixed inset-x-0 z-20 flex flex-col gap-3 bg-gradient-to-t from-background via-background/95 to-transparent pt-16 pb-2"
      >
        {flares === "2" && <FlareRail />}

        {flares === "0" && (
          <div className="scrollbar-none flex gap-1 overflow-x-auto px-3 py-1.5">
            {hasPeople ? (
              FRIENDS.map((f) => (
                <PersonButton
                  key={f.name}
                  {...f}
                  selected={people.includes(f.name)}
                  onToggle={() => togglePerson(f.name)}
                />
              ))
            ) : (
              <EmptyPeople
                label={viewer === "new" ? "invite" : "sign up"}
                onAdd={() => onStub(viewer === "new" ? "invite" : "sign up")}
              />
            )}
          </div>
        )}

        <div className="scrollbar-none -mt-1.5 flex justify-between gap-2 overflow-x-auto px-3 py-1.5">
          {MOVES.map((m) => {
            const { icon: Icon, label } = typeOf(m.type)
            const selected = moveType === m.type
            return (
              <button
                key={m.type}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setMoveType((prev) => (prev === m.type ? null : m.type))
                }
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <span
                  style={tint(m.hue)}
                  className={cn(
                    "flex size-14 items-center justify-center rounded-2xl transition-transform duration-200 active:scale-95",
                    selected &&
                      "scale-105 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <span className="text-xs font-medium">{label}</span>
              </button>
            )
          })}
        </div>

        {/* Once there's something to light, point at the flame. */}
        <div
          className={cn(
            "flex justify-center transition-opacity duration-300",
            composed && flares === "0" ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            tap the flame to light it
            <CaretDownIcon className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
}
