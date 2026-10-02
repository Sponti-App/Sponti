"use client"

// PROTOTYPE (#162) — throwaway. Small atoms shared by the layout variants,
// plus the prototype switcher. Layout itself is deliberately NOT shared.

import { useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/components/event-avatar-stack"
import { cn } from "@/lib/utils"
import {
  DISTANCES,
  TIMINGS,
  TIMINGS_D,
  VIEWERS,
  categoryOf,
  tintFor,
  type MockFlare,
  type MockPerson,
  type Arrival,
  type Distance,
  type Timing,
  type Viewer,
} from "./_mock"

export type VariantProps = {
  flare: MockFlare
  viewer: Viewer
  now: number
  myEta: number
  plusOne: boolean
  onEtaChange: (min: number) => void
  /** Layout D only: pre-start arrival answer, and whether an ETA is shared. */
  arrival?: Arrival
  onArrivalChange?: (a: Arrival) => void
  etaShared?: boolean
  onEtaSharedChange?: (v: boolean) => void
  onPlusOneChange: (value: boolean) => void
  onJoin: () => void
  onLeave: () => void
  /** Stand-in for navigation/mutations the prototype doesn't do. */
  onStub: (what: string) => void
}

export function PersonAvatar({
  person,
  className,
}: {
  person: Pick<MockPerson, "displayName">
  className?: string
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className="text-xs">
        {initials(person.displayName)}
      </AvatarFallback>
    </Avatar>
  )
}

/** PLACEHOLDER for #138 — category icon on its tint. */
export function CategoryTile({
  flare,
  size = "md",
}: {
  flare: MockFlare
  size?: "sm" | "md" | "lg"
}) {
  const { icon: Icon, label } = categoryOf(flare)
  const tint = tintFor(flare)
  return (
    <div
      aria-label={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size === "sm" && "h-8 w-8 rounded-lg",
        size === "md" && "h-11 w-11",
        size === "lg" && "h-14 w-14 rounded-2xl"
      )}
      style={{ backgroundColor: tint.bg, color: tint.fg }}
    >
      <Icon
        className={
          size === "lg" ? "h-7 w-7" : size === "md" ? "h-5 w-5" : "h-4 w-4"
        }
      />
    </div>
  )
}

/** Marks a slot that belongs to another issue, so reviewers can tell. */
export function PlaceholderTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-dashed border-border px-1.5 text-xs text-muted-foreground/70">
      {children}
    </span>
  )
}

export const VARIANTS = [
  { key: "A", name: "compact header" },
  { key: "B", name: "map + sheet" },
  { key: "C", name: "live feed" },
  { key: "D", name: "b + c (decided)" },
] as const
export type VariantKey = (typeof VARIANTS)[number]["key"]

/**
 * Prototype-only control bar. Sits in-flow at the top (the app's bottom nav
 * owns the bottom edge). Dark, monospace-ish pill so it's obviously not
 * part of the design being judged. ← / → cycle layouts.
 */
export type BarState = {
  variant: VariantKey
  viewer: Viewer
  timing: Timing
  distance: Distance
}

export function PrototypeBar({
  variant,
  viewer,
  timing,
  distance,
  onChange,
}: BarState & {
  onChange: (next: Partial<BarState>) => void
}) {
  const isD = variant === "D"
  const index = VARIANTS.findIndex((v) => v.key === variant)
  const cycle = (dir: 1 | -1) =>
    onChange({
      variant: VARIANTS[(index + dir + VARIANTS.length) % VARIANTS.length].key,
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowLeft") cycle(-1)
      if (e.key === "ArrowRight") cycle(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-100">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => cycle(-1)}
          aria-label="previous layout"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="truncate">
          {variant} — {VARIANTS[index].name}
        </span>
        <button
          type="button"
          onClick={() => cycle(1)}
          aria-label="next layout"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <Seg
          options={VIEWERS}
          value={viewer}
          onChange={(v) => onChange({ viewer: v })}
        />
        <Seg
          options={isD ? TIMINGS_D : TIMINGS}
          value={!isD && timing === "soon" ? "upcoming" : timing}
          onChange={(t) => onChange({ timing: t })}
        />
      </div>
      {isD && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-zinc-400">viewer distance</span>
          <Seg
            options={DISTANCES}
            value={distance}
            onChange={(d) => onChange({ distance: d })}
          />
        </div>
      )}
    </div>
  )
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-full bg-zinc-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-2 py-1 whitespace-nowrap",
            o.key === value ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
