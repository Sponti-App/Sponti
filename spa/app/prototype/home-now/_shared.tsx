"use client"

// PROTOTYPE (#522), throwaway. The frame the three takes share: a faux map
// with idea spots, the #519 top bar (now/soon), the 2-flare rail and the
// type chips, plus the prototype switcher. The two takes themselves live in
// _combined.tsx and _wildcard.tsx and are deliberately not shared.

import type { ReactNode } from "react"
import {
  CalendarBlankIcon,
  ListIcon,
  MapTrifoldIcon,
  UserPlusIcon,
} from "@/components/icons"
import { FLARE_IDEAS, type FlareIdea } from "@/lib/flare-ideas.data"
import { EVENT_TYPES } from "@/types/utils"
import { cn } from "@/lib/utils"

export type Viewer = "signedOut" | "new" | "friends"
export type Flares = "0" | "2"

export const VIEWERS: { key: Viewer; label: string }[] = [
  { key: "signedOut", label: "signed out" },
  { key: "new", label: "0 friends" },
  { key: "friends", label: "has friends" },
]

export const VARIANTS = [
  { key: "combined", name: "1 combined" },
  { key: "wildcard", name: "2 wildcard" },
] as const
export type VariantKey = (typeof VARIANTS)[number]["key"]

export type VariantProps = {
  viewer: Viewer
  flares: Flares
  /** Wildcard only: start with mia and drinks picked (for screenshots). */
  picked: boolean
  /** Stand-in for navigation the prototype doesn't do. */
  onStub: (what: string) => void
}

// ---- mock data --------------------------------------------------------------

/** Newest connection first. `hue` stands in for the host colour on avatars. */
export const FRIENDS = [
  { name: "mia", connected: "2 days ago", isNew: true, hue: 315 },
  { name: "jonas", connected: "this week", isNew: true, hue: 185 },
  { name: "lea", connected: "in may", isNew: false, hue: 260 },
  { name: "sam", connected: "in april", isNew: false, hue: 140 },
]

/** An avatar's initials on its host colour. */
export function avatarStyle(hue: number) {
  return {
    backgroundColor: `oklch(0.88 0.06 ${hue})`,
    color: `oklch(0.35 0.09 ${hue})`,
  }
}

export type MockFlare = {
  id: string
  title: string
  type: (typeof EVENT_TYPES)[number]["value"]
  host: string
  when: string
  where: string
  live: boolean
}

export const MOCK_FLARES: MockFlare[] = [
  {
    id: "f1",
    title: "after-work beers",
    type: "drinks",
    host: "mia",
    when: "live · till 21:00",
    where: "prater garten · 1.2 km",
    live: true,
  },
  {
    id: "f2",
    title: "ping-pong in mauerpark",
    type: "sports",
    host: "jonas",
    when: "at 18:30",
    where: "mauerpark · 800 m",
    live: false,
  },
]

/** Three year-round ideas in different categories, for the idea row. */
export const IDEAS: FlareIdea[] = (() => {
  const picked: FlareIdea[] = []
  for (const idea of FLARE_IDEAS) {
    if (idea.season) continue
    if (picked.some((p) => p.category === idea.category)) continue
    picked.push(idea)
    if (picked.length === 3) break
  }
  return picked
})()

export function typeOf(value: string) {
  return EVENT_TYPES.find((t) => t.value === value) ?? EVENT_TYPES[0]
}

// ---- the frame --------------------------------------------------------------

/** Where the idea spots sit on the faux map (percent of the frame). */
const SPOTS: { top: string; left: string; type: string }[] = [
  { top: "24%", left: "14%", type: "sports" },
  { top: "28%", left: "52%", type: "party" },
  { top: "41%", left: "12%", type: "culture" },
  { top: "40%", left: "66%", type: "hobby" },
  { top: "48%", left: "38%", type: "hangout" },
]

/** A map stand-in: streets, parks, the idea spots and the user's dot. */
export function FauxMap({
  flares,
  ideasEmphasized = false,
}: {
  flares: Flares
  ideasEmphasized?: boolean
}) {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 size-full" preserveAspectRatio="none">
        <defs>
          <pattern
            id="grid"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M56 0H0V56"
              fill="none"
              className="stroke-border"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.6" />
        <path
          d="M-20 180 L420 120 M60 -10 L210 900 M-10 520 L420 430 M300 -10 L250 900"
          className="stroke-card"
          strokeWidth="9"
          fill="none"
        />
        <ellipse
          cx="90"
          cy="300"
          rx="70"
          ry="44"
          className="fill-[oklch(0.86_0.05_140)] dark:fill-[oklch(0.35_0.04_140)]"
          opacity="0.55"
        />
      </svg>

      {SPOTS.map((spot) => {
        const Icon = typeOf(spot.type).icon
        return (
          <span
            key={spot.top + spot.left}
            style={{ top: spot.top, left: spot.left }}
            className={cn(
              "absolute flex items-center justify-center rounded-full border border-dashed bg-background/80",
              ideasEmphasized
                ? "size-10 border-primary/70 text-foreground"
                : "size-8 border-muted-foreground/60 text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
          </span>
        )
      })}

      {flares === "2" &&
        MOCK_FLARES.map((flare, i) => {
          const Icon = typeOf(flare.type).icon
          return (
            <span
              key={flare.id}
              style={{ top: i ? "33%" : "52%", left: i ? "30%" : "58%" }}
              className={cn(
                "absolute flex size-11 items-center justify-center rounded-full border-2 border-background text-white shadow-md",
                "bg-[oklch(0.55_0.09_190)]",
                flare.live && "ring-4 ring-primary/70"
              )}
            >
              <Icon className="size-5" />
            </span>
          )
        })}

      <span className="absolute top-[45%] left-[48%] size-4 rounded-full border-2 border-white bg-[oklch(0.6_0.18_255)] shadow-[0_0_0_8px_oklch(0.6_0.18_255/0.18)]" />
    </div>
  )
}

const SURFACE =
  "h-11 rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md"

/** The #519 top bar: 44px menu, now/soon toggle, invite or sign in. */
export function TopBar({ viewer }: { viewer: Viewer }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 pt-3">
      {viewer === "signedOut" ? (
        <span className="size-11" />
      ) : (
        <span className={cn(SURFACE, "flex w-11 items-center justify-center")}>
          <ListIcon className="size-4" />
        </span>
      )}
      <span className={cn(SURFACE, "flex items-center p-1 text-sm")}>
        <span className="flex h-full items-center gap-1.5 rounded-full bg-card px-3.5 font-semibold">
          <MapTrifoldIcon className="size-4" /> now
        </span>
        <span className="flex h-full items-center gap-1.5 px-3.5 font-medium text-muted-foreground">
          <CalendarBlankIcon className="size-4" /> soon
        </span>
      </span>
      <span
        className={cn(
          SURFACE,
          "flex items-center gap-1.5 px-3.5 text-sm font-medium"
        )}
      >
        {viewer === "signedOut" ? (
          "sign in"
        ) : (
          <>
            <UserPlusIcon className="size-4" /> invite
          </>
        )}
      </span>
    </div>
  )
}

/** The sheet's slot: sits on the app's bottom nav. */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ bottom: "var(--sponti-nav-h, 64px)" }}
      className="fixed inset-x-0 z-20 flex flex-col gap-2 pb-2"
    >
      {children}
    </div>
  )
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-3 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-(--shadow-card) backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  )
}

/** The rail of flare cards, for the "2 flares" state. */
export function FlareRail() {
  return (
    <div className="flex snap-x gap-2 overflow-x-auto px-3">
      {MOCK_FLARES.map((flare) => {
        const Icon = typeOf(flare.type).icon
        return (
          <div
            key={flare.id}
            className={cn(
              "w-[78%] shrink-0 snap-start rounded-2xl border border-border/60 bg-card p-3 shadow-(--shadow-card)",
              flare.live && "border-l-[3px] border-l-accent"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{flare.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {flare.host} · {flare.when}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{flare.where}</p>
          </div>
        )
      })}
    </div>
  )
}

/** Type chips: only once there's something to filter (two or more). */
export function TypeChips() {
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto">
      {EVENT_TYPES.map(({ value, label, icon: Icon }) => (
        <span
          key={value}
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-xs"
        >
          <Icon className="size-3.5" /> {label}
        </span>
      ))}
    </div>
  )
}

/** The prototype switcher, dark so it's obviously not part of the design. */
export function PrototypeBar({
  variant,
  viewer,
  flares,
  onChange,
}: {
  variant: VariantKey
  viewer: Viewer
  flares: Flares
  onChange: (
    next: Partial<{ variant: VariantKey; viewer: Viewer; flares: Flares }>
  ) => void
}) {
  const pill = (active: boolean) =>
    cn(
      "rounded-full px-2 py-1 font-mono text-[11px]",
      active ? "bg-white text-black" : "text-white/70"
    )
  return (
    <div className="fixed inset-x-2 top-16 z-[60] flex flex-wrap items-center gap-1 rounded-2xl bg-black/85 p-1.5 text-white">
      {VARIANTS.map((v) => (
        <button
          key={v.key}
          type="button"
          className={pill(variant === v.key)}
          onClick={() => onChange({ variant: v.key })}
        >
          {v.name}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-white/30" />
      {VIEWERS.map((v) => (
        <button
          key={v.key}
          type="button"
          className={pill(viewer === v.key)}
          onClick={() => onChange({ viewer: v.key })}
        >
          {v.label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-white/30" />
      {(["0", "2"] as const).map((n) => (
        <button
          key={n}
          type="button"
          className={pill(flares === n)}
          onClick={() => onChange({ flares: n })}
        >
          {n} flares
        </button>
      ))}
    </div>
  )
}
