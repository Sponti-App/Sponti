"use client"

// PROTOTYPE (#223): throwaway. Pieces shared by the drawer variants (map
// backdrop, header chips, list rows, filters, the prototype bar). The sheet
// geometry and gestures are deliberately NOT shared: that's what differs.

import { useEffect, useState } from "react"
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Map as MapIcon,
  Menu,
  Settings,
  X,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EVENT_TYPES } from "@/types/utils"
import type { EventType } from "@/lib/api/events"
import { cn } from "@/lib/utils"
import {
  SNAPS,
  TABS,
  ctaFor,
  isLive,
  metaLine,
  typeInfo,
  type MockFlare,
  type Snap,
  type TimeTab,
} from "./_mock"

export type VariantProps = {
  snap: Snap
  onSnap: (s: Snap) => void
  tab: TimeTab
  onTab: (t: TimeTab) => void
  types: EventType[]
  onToggleType: (t: EventType) => void
  onClearTypes: () => void
  flares: MockFlare[]
  /** Open the composer, with the type preselected when there is one. */
  onCta: (type: EventType | null) => void
  onOpenFlare: (f: MockFlare) => void
  /** Stand-in for navigation the prototype doesn't do. */
  onStub: (what: string) => void
}

/** The snap curve vaul uses, so the custom sheet feels like the app's other sheets. */
export const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)"
export const SHEET_MS = 500

/**
 * Space the home header chips need at the top (menu, map/calendar, settings).
 * A fully expanded sheet stops below it, so the view toggle stays reachable.
 */
export const TOP_RESERVED_CSS = "calc(env(safe-area-inset-top) + 3.75rem)"

/**
 * Part of the proposed fix (used by A–C, not O). BottomNav publishes
 * --sponti-nav-h from a ResizeObserver on the nav's default *content box*.
 * When Safari hides its toolbars only env(safe-area-inset-bottom) changes,
 * i.e. the nav's padding-bottom, so the content box doesn't change, the
 * observer never fires and --sponti-nav-h goes stale by ~26px. Observing the
 * border box keeps it in sync. (Production fix: one line in bottom-nav.tsx.)
 */
export function useBorderBoxNavHeight(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Primary"]')
    if (!nav) return
    const write = () =>
      document.documentElement.style.setProperty("--sponti-nav-h", `${nav.offsetHeight}px`)
    write()
    const ro = new ResizeObserver(write)
    ro.observe(nav, { box: "border-box" })
    return () => ro.disconnect()
  }, [enabled])
}

// ---------------------------------------------------------------------------
// map backdrop (a static, theme-aware "map-ish" tile, no Google Maps key needed)

const ROAD = "var(--card)"
// Mixed in srgb: an oklch mix from the pink --muted hue swings through orange.
const PARK = "color-mix(in srgb, var(--muted) 55%, #7fbf8a)"
const WATER = "color-mix(in srgb, var(--muted) 50%, #7fa8d6)"

export function MapBackdrop({
  flares,
  highlightId,
  onPin,
}: {
  flares: MockFlare[]
  highlightId?: string | null
  onPin?: (f: MockFlare) => void
}) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-muted">
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 375 812"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="0" y="0" width="375" height="812" fill="var(--muted)" />
        <path d="M-20 560 C 80 520, 140 610, 230 580 S 360 520, 420 560 L 420 620 C 340 580, 260 650, 190 640 S 60 600, -20 620 Z" fill={WATER} />
        <rect x="200" y="120" width="120" height="110" rx="10" fill={PARK} />
        <rect x="30" y="360" width="90" height="120" rx="10" fill={PARK} />
        <g stroke={ROAD} strokeLinecap="round" fill="none">
          <path d="M-10 90 L 400 150" strokeWidth="14" />
          <path d="M-10 300 L 400 270" strokeWidth="18" />
          <path d="M-10 480 L 400 500" strokeWidth="10" />
          <path d="M-10 720 L 400 690" strokeWidth="14" />
          <path d="M70 -10 L 110 830" strokeWidth="12" />
          <path d="M180 -10 L 160 830" strokeWidth="18" />
          <path d="M300 -10 L 330 830" strokeWidth="10" />
          <path d="M0 200 L 180 250 L 375 380" strokeWidth="6" />
          <path d="M120 820 L 250 420 L 375 440" strokeWidth="6" />
        </g>
      </svg>

      {/* you */}
      <div className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
        <div className="relative h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
      </div>

      {flares.map((f) => {
        const Icon = typeInfo(f.type).icon
        const hot = highlightId === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onPin?.(f)}
            aria-label={f.title}
            style={{ left: `${f.pin.x}%`, top: `${f.pin.y}%` }}
            className={cn(
              "absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-background text-foreground shadow-md transition-transform duration-200",
              isLive(f) ? "border-accent" : "border-border",
              hot && "z-10 scale-125 ring-2 ring-accent ring-offset-2 ring-offset-background"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}

/** The home page's floating header chips, so the top of the screen reads as home. */
export function HeaderChips() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <span className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
        <Menu className="h-4 w-4" />
      </span>
      <div className="pointer-events-auto flex items-center rounded-full border border-border/60 bg-background/70 p-1 shadow-sm backdrop-blur-md">
        <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold">
          <MapIcon className="h-4 w-4" />
          map
        </span>
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          calendar
        </span>
      </div>
      <span className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
        <Settings className="h-4 w-4" />
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// sheet content atoms

export function SheetHeading({ count, action }: { count: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">flares near you</h2>
      {action ?? <span className="text-xs text-muted-foreground">{count} active</span>}
    </div>
  )
}

export function TimeTabs({
  tab,
  onTab,
  className,
}: {
  tab: TimeTab
  onTab: (t: TimeTab) => void
  className?: string
}) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTab(v as TimeTab)} className={className}>
      <TabsList className="h-8 w-full">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="text-xs">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/**
 * Horizontal chip row. `touch-action: pan-x` lets it scroll sideways even
 * inside a sheet that owns vertical drags.
 */
export function TypeChips({
  types,
  onToggleType,
  onClearTypes,
  className,
}: Pick<VariantProps, "types" | "onToggleType" | "onClearTypes"> & { className?: string }) {
  return (
    <div
      data-vaul-no-drag
      className={cn("scrollbar-none -mx-4 flex touch-pan-x items-center gap-2 overflow-x-auto px-4 pb-1", className)}
    >
      {EVENT_TYPES.map((t) => {
        const on = types.includes(t.value)
        const Icon = t.icon
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onToggleType(t.value)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-[0.97]",
              on
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            <Icon className="h-3 w-3" />
            {t.label}
          </button>
        )
      })}
      {types.length > 0 && (
        <button
          type="button"
          onClick={onClearTypes}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground"
        >
          <X className="h-3 w-3" />
          clear
        </button>
      )}
    </div>
  )
}

export function FlareRow({ flare, onClick }: { flare: MockFlare; onClick: () => void }) {
  const Icon = typeInfo(flare.type).icon
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer flex-row items-center gap-3.5 rounded-xl border border-border p-3 active:bg-muted",
        isLive(flare) && "border-l-[3px] border-l-accent"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-medium">{flare.title}</p>
          {flare.joined && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
              <Check className="h-2.5 w-2.5" /> going
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{metaLine(flare)}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Card>
  )
}

/**
 * The CTA under the list. Quiet (outline) by default so it doesn't compete
 * with the peach FAB; `loud` makes it the screen's one peach surface.
 */
export function ListCta({
  types,
  onCta,
  loud = false,
}: Pick<VariantProps, "types" | "onCta"> & { loud?: boolean }) {
  const cta = ctaFor(types)
  const Icon = cta.type ? typeInfo(cta.type).icon : Flame
  return (
    <button
      type="button"
      onClick={() => onCta(cta.type)}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold active:scale-[0.98]",
        loud
          ? "bg-accent text-accent-foreground"
          : "border border-border bg-card text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4", !loud && "text-accent")} />
      {cta.label}
    </button>
  )
}

export function EmptyList({ types, onCta }: Pick<VariantProps, "types" | "onCta">) {
  const cta = ctaFor(types)
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-medium">
        nothing {cta.type ? `${typeInfo(cta.type).label} ` : ""}nearby right now
      </p>
      <p className="mt-1 text-xs text-muted-foreground">be the one who starts it</p>
      <div className="mt-3">
        <ListCta types={types} onCta={onCta} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// prototype bar

export const VARIANTS = [
  { key: "O", name: "today (reference, has the bugs)" },
  { key: "A", name: "anchored custom sheet" },
  { key: "B", name: "vaul drawer" },
  { key: "C", name: "cards + list toggle" },
] as const
export type VariantKey = (typeof VARIANTS)[number]["key"]

export type BarState = {
  variant: VariantKey
  snap: Snap
  types: string
  fs: "0" | "1"
}

const QUICK_TYPES: { key: string; label: string }[] = [
  { key: "", label: "no filter" },
  { key: "drinks", label: "drinks" },
  { key: "food", label: "food" },
  { key: "party", label: "party" },
]

/**
 * Prototype-only control bar. Floats at the top (dark, monospace) so it is
 * obviously not part of the design being judged; collapses to a pill.
 * ← / → cycle variants.
 */
export function PrototypeBar({
  variant,
  snap,
  types,
  fs,
  onChange,
}: BarState & { onChange: (next: Partial<BarState>) => void }) {
  const [open, setOpen] = useState(true)
  const index = VARIANTS.findIndex((v) => v.key === variant)
  const cycle = (dir: 1 | -1) =>
    onChange({ variant: VARIANTS[(index + dir + VARIANTS.length) % VARIANTS.length].key })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") cycle(-1)
      if (e.key === "ArrowRight") cycle(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-14 left-3 z-[80] rounded-full bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100 shadow-lg"
      >
        proto {variant} · {snap}
      </button>
    )
  }

  return (
    <div className="fixed inset-x-2 top-14 z-[80] rounded-xl bg-zinc-900/95 p-2 font-mono text-xs text-zinc-100 shadow-lg">
      <div className="flex items-center justify-between gap-1">
        <button type="button" onClick={() => cycle(-1)} aria-label="previous variant" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="truncate">
          {variant} · {VARIANTS[index].name}
        </span>
        <button type="button" onClick={() => cycle(1)} aria-label="next variant" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="collapse" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Seg options={SNAPS} value={snap} onChange={(s) => onChange({ snap: s })} />
        <Seg
          options={[
            { key: "0" as const, label: "toolbars" },
            { key: "1" as const, label: "safari fullscreen" },
          ]}
          value={fs}
          onChange={(v) => onChange({ fs: v })}
        />
        <Seg options={QUICK_TYPES} value={QUICK_TYPES.some((q) => q.key === types) ? types : "x"} onChange={(t) => onChange({ types: t })} />
      </div>
    </div>
  )
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T | string
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-full bg-zinc-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.key || "none"}
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
