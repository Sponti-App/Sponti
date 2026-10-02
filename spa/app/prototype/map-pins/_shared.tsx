"use client"

// PROTOTYPE (#315): shared pieces for the three pin options. Throwaway.

import { useState, type CSSProperties, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react"
import type { EventType, EventVisibility } from "@/lib/api/events"
import { EVENT_TYPES } from "@/types/utils"
import { ME_DOT, type MockIdea, type MockPin, type PopoverKey } from "./_mock"

// ---------------------------------------------------------------------------
// Tokens. Proposed only for this prototype; nothing here touches globals.css.
// Every tint is a low-chroma oklch with its own light and dark lightness, so
// it stays a tint in both modes. Peach (--accent) is not used for any of them.
// ---------------------------------------------------------------------------

export const PROTO_CSS = `
.proto-315 {
  --map-land: oklch(0.955 0.012 346);
  --map-block: oklch(0.935 0.014 346);
  --map-road: oklch(0.995 0.004 346);
  --map-road-major: oklch(0.985 0.02 70);
  --map-park: oklch(0.925 0.035 150);
  --map-water: oklch(0.89 0.035 235);
  --map-label: oklch(0.6 0.03 346);
  --tint-l: 0.93; --tint-c: 0.045;
  --ink-l: 0.48; --ink-c: 0.11;
  --avatar-l: 0.84; --avatar-c: 0.07;
  --avatar-ink-l: 0.3; --avatar-ink-c: 0.06;
  --vis-l: 0.87; --vis-c: 0.07;
  --vis-ink-l: 0.36; --vis-ink-c: 0.09;
}
.dark .proto-315 {
  --map-land: oklch(0.235 0.016 266);
  --map-block: oklch(0.255 0.016 266);
  --map-road: oklch(0.31 0.02 266);
  --map-road-major: oklch(0.36 0.025 266);
  --map-park: oklch(0.27 0.03 165);
  --map-water: oklch(0.2 0.035 250);
  --map-label: oklch(0.55 0.02 266);
  --tint-l: 0.36; --tint-c: 0.05;
  --ink-l: 0.86; --ink-c: 0.08;
  --avatar-l: 0.5; --avatar-c: 0.08;
  --avatar-ink-l: 0.97; --avatar-ink-c: 0.02;
  --vis-l: 0.45; --vis-c: 0.08;
  --vis-ink-l: 0.95; --vis-ink-c: 0.03;
}
`

/** #138 proposal: one hue per category, used only as a subtle tint. */
export const CATEGORY_HUE: Record<EventType, number> = {
  hangout: 300,
  drinks: 15,
  food: 80,
  party: 340,
  sports: 150,
  culture: 250,
  hobby: 195,
}

/** Option B only: who can join, as a hue. */
export const VISIBILITY_HUE: Record<EventVisibility, number> = {
  private: 315,
  public: 185,
}

export const tint = (hue: number) => `oklch(var(--tint-l) var(--tint-c) ${hue})`
export const ink = (hue: number) => `oklch(var(--ink-l) var(--ink-c) ${hue})`
export const visFill = (v: EventVisibility) =>
  `oklch(var(--vis-l) var(--vis-c) ${VISIBILITY_HUE[v]})`
export const visInk = (v: EventVisibility) =>
  `oklch(var(--vis-ink-l) var(--vis-ink-c) ${VISIBILITY_HUE[v]})`

export const VISIBILITY_LABEL: Record<EventVisibility, string> = {
  private: "invite only",
  public: "open to all",
}

export function categoryOf(type: EventType) {
  const match = EVENT_TYPES.find((t) => t.value === type)
  return { label: match?.label ?? type, Icon: match?.icon ?? MapPin }
}

// ---------------------------------------------------------------------------
// Option contract
// ---------------------------------------------------------------------------

export type OptionKey = "A" | "B" | "C"

export type PinProps = { pin: MockPin; selected: boolean }
export type PopoverProps = {
  pin: MockPin
  onOpen: () => void
  onClose: () => void
}

export type OptionDef = {
  key: OptionKey
  name: string
  /** One line for the note at the top of the map. */
  rule: string
  Pin: (p: PinProps) => ReactNode
  Idea: (p: { idea: MockIdea }) => ReactNode
  Popover: (p: PopoverProps) => ReactNode
  /** Popover width in px, for placing it above the pin. */
  popoverWidth: number
  /** Optional overlay at the top of the map (B's legend). */
  Legend?: () => ReactNode
}

// ---------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------

/** Initials over the host colour (BRAND.md §8 avatar). */
export function HostAvatar({
  host,
  size = 40,
  className = "",
}: {
  host: MockPin["host"]
  size?: number
  className?: string
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-xs font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: `oklch(var(--avatar-l) var(--avatar-c) ${host.hue})`,
        color: `oklch(var(--avatar-ink-l) var(--avatar-ink-c) ${host.hue})`,
      }}
    >
      {size < 28 ? host.initials.charAt(0) : host.initials}
    </span>
  )
}

/** The peach live dot, the one place every option spends peach on a pin. */
export function LiveDot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
}

/** "live · ends in 40 min" or "starts 7pm", with the live dot. */
export function TimeLine({ pin }: { pin: MockPin }) {
  return (
    <span className="flex items-center gap-1.5">
      {pin.timing === "live" && <LiveDot />}
      {pin.timing === "live" ? `live · ${pin.timeLabel}` : pin.timeLabel}
    </span>
  )
}

export function hostLine(pin: MockPin) {
  return pin.own ? "your flare" : `by ${pin.host.name}`
}

/** The dashed, monospace prototype annotation. Never product UI. */
export function Note({
  children,
  wrap = false,
}: {
  children: ReactNode
  wrap?: boolean
}) {
  return (
    <span
      className={`pointer-events-none rounded border border-dashed border-muted-foreground/50 bg-background/85 px-1 font-mono text-xs text-muted-foreground ${
        wrap ? "text-center" : "whitespace-nowrap"
      }`}
    >
      {children}
    </span>
  )
}

/** The popover's close button. */
export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="close"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// The map stand-in: a static street plan in brand-like map colours. Real
// Google tiles need a key and don't render headless; #130 owns the tiles.
// ---------------------------------------------------------------------------

export function MapStandIn() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 375 720"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="375" height="720" fill="var(--map-land)" />
      {/* blocks */}
      {Array.from({ length: 8 }).flatMap((_, r) =>
        Array.from({ length: 5 }).map((__, c) => (
          <rect
            key={`${r}-${c}`}
            x={8 + c * 76}
            y={8 + r * 90}
            width={62}
            height={74}
            rx={4}
            fill="var(--map-block)"
          />
        ))
      )}
      {/* parks: humboldthain top-left, mauerpark right */}
      <path
        d="M20 60 L150 40 L170 170 L40 190 Z"
        fill="var(--map-park)"
        opacity="0.95"
      />
      <path
        d="M240 330 L360 320 L370 500 L250 490 Z"
        fill="var(--map-park)"
        opacity="0.95"
      />
      {/* the river */}
      <path
        d="M-10 600 C 80 560, 140 650, 230 620 S 340 560, 390 590 L390 650 C 330 620, 280 690, 220 680 S 80 620, -10 660 Z"
        fill="var(--map-water)"
      />
      {/* minor roads */}
      <g stroke="var(--map-road)" strokeWidth="6" fill="none">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={`v${i}`} x1={2 + i * 76} y1="0" x2={2 + i * 76} y2="720" />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line key={`h${i}`} x1="0" y1={2 + i * 90} x2="375" y2={2 + i * 90} />
        ))}
      </g>
      {/* major roads */}
      <g stroke="var(--map-road-major)" strokeWidth="11" fill="none">
        <path d="M-10 260 L390 220" />
        <path d="M200 -10 L170 730" />
        <path d="M-10 470 C 120 430, 260 470, 390 420" />
      </g>
      <g
        fill="var(--map-label)"
        fontSize="12"
        fontFamily="var(--font-sans)"
        fontStyle="italic"
      >
        <text x="44" y="122">
          humboldthain
        </text>
        <text x="264" y="420">
          mauerpark
        </text>
        <text x="60" y="636">
          spree
        </text>
      </g>
    </svg>
  )
}

/** The viewer's blue dot, as on the real map. */
export function MeDot() {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${ME_DOT.x}%`, top: `${ME_DOT.y}%` }}
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute h-6 w-6 rounded-full bg-blue-400/30" />
        <div className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
      </div>
    </div>
  )
}

/**
 * Places a popover above a pin: clamped to the 16px gutters, with the arrow
 * on the pin. Pins are 40px and centred on their point.
 */
export function PopoverFrame({
  pin,
  width,
  children,
}: {
  pin: MockPin
  width: number
  children: ReactNode
}) {
  const left = `clamp(16px, calc(${pin.x}% - ${width / 2}px), calc(100% - ${width + 16}px))`
  const box: CSSProperties = {
    left,
    top: `${pin.y}%`,
    width,
    transform: "translateY(calc(-100% - 30px))",
  }
  return (
    <>
      <div
        data-flare-preview={pin.id}
        className="absolute z-30 animate-[scale-in_150ms_ease-out]"
        style={box}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="absolute z-30 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[8px] border-x-transparent border-t-card"
        style={{
          left: `${pin.x}%`,
          top: `${pin.y}%`,
          transform: "translate(-50%, -31px)",
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// The prototype bar
// ---------------------------------------------------------------------------

export type BarState = {
  option: OptionKey
  popover: PopoverKey
  theme: "light" | "dark"
  notes: boolean
}

export function PrototypeBar({
  state,
  options,
  onChange,
}: {
  state: BarState
  options: OptionDef[]
  onChange: (next: Partial<BarState>) => void
}) {
  const [open, setOpen] = useState(true)
  const index = options.findIndex((o) => o.key === state.option)
  const cycle = (dir: 1 | -1) =>
    onChange({
      option: options[(index + dir + options.length) % options.length].key,
    })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-3 z-[80] rounded-full bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100 shadow-lg"
      >
        proto {state.option} · {state.popover} · {state.theme}
      </button>
    )
  }

  return (
    <div className="fixed inset-x-2 bottom-24 z-[80] rounded-xl bg-zinc-900/95 p-2 font-mono text-xs text-zinc-100 shadow-lg">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => cycle(-1)}
          aria-label="previous option"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="truncate">
          {state.option} · {options[index].name}
        </span>
        <button
          type="button"
          onClick={() => cycle(1)}
          aria-label="next option"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="collapse"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Seg
          options={[
            { key: "none" as const, label: "no popover" },
            { key: "private" as const, label: "private" },
            { key: "public" as const, label: "public" },
          ]}
          value={state.popover}
          onChange={(v) => onChange({ popover: v })}
        />
        <Seg
          options={[
            { key: "light" as const, label: "light" },
            { key: "dark" as const, label: "dark" },
          ]}
          value={state.theme}
          onChange={(v) => onChange({ theme: v })}
        />
        <Seg
          options={[
            { key: "1" as const, label: "notes" },
            { key: "0" as const, label: "clean" },
          ]}
          value={state.notes ? "1" : "0"}
          onChange={(v) => onChange({ notes: v === "1" })}
        />
      </div>
    </div>
  )
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[]
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
          className={`rounded-full px-2 py-1 ${
            value === o.key ? "bg-zinc-100 text-zinc-900" : "text-zinc-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Idea pin: the same in every option. Today's #244 mark (smaller, muted fill,
// dashed outline, grey icon, no peach, no chip) already never reads as a
// flare, and no option needs to change it. Each option only checks that its
// own flare language doesn't drift towards it.
// ---------------------------------------------------------------------------

export function IdeaMark({ idea }: { idea: MockIdea }) {
  const { Icon } = categoryOf(idea.type)
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/70 bg-muted text-muted-foreground shadow-md">
      <Icon className="h-3.5 w-3.5" />
    </div>
  )
}

/** The small chip under a pin: "live", "7pm", or "you · live". */
export function PinChip({
  pin,
  withYou = true,
}: {
  pin: MockPin
  withYou?: boolean
}) {
  const live = pin.timing === "live"
  return (
    <span
      className={`mt-1 flex items-center gap-1 rounded-full bg-card px-1.5 text-xs leading-5 shadow ${
        live ? "font-medium text-foreground" : "text-muted-foreground"
      }`}
    >
      {live && <LiveDot />}
      {withYou && pin.own ? `you · ${pin.shortTime}` : pin.shortTime}
    </span>
  )
}
