"use client"

// PROTOTYPE (#373) — throwaway. Atoms shared by the round 2 flow: the
// prototype bar, brand bits, the mock home map (header, pins, idea spots,
// dock, FAB, nav), the small UI fragments the slides show and the coach mark
// overlay. Real components where cheap (FlarePin, FlarePreviewCard,
// NavFlareButton, VisibilityLegend, Tabs, Button, Avatar); everything else is
// a look-alike on mock data.

import { useEffect, useLayoutEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  BellIcon,
  CalendarBlankIcon,
  CheckIcon,
  ClockIcon,
  FireIcon,
  FlameIcon,
  GearIcon,
  GlobeIcon,
  HouseIcon,
  ListIcon,
  LockIcon,
  MapPinIcon,
  MapTrifoldIcon,
  NavigationArrowIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons"
import { NavFlareButton } from "@/components/bottom-nav"
import { initials } from "@/components/event-avatar-stack"
import { FlarePin, VisibilityLegend } from "@/components/map-flare-pin"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { EventItem, EventType } from "@/lib/api/events"
import type { FlareIdea } from "@/lib/flare-ideas"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"
import type { MockPerson } from "./_mock"

// ---- Prototype state -------------------------------------------------------

/** The takes and open calls the bar switches between. */
export const TOGGLES = {
  marks: [
    { key: "A", label: "marks a" },
    { key: "B", label: "marks b" },
  ],
  gate: [
    { key: "sheet", label: "gate: sheet" },
    { key: "page", label: "gate: page" },
  ],
  at: [
    { key: "tap", label: "ask on tap" },
    { key: "light", label: "ask on light" },
  ],
  friends: [
    { key: "0", label: "0 friends" },
    { key: "3", label: "3 friends" },
  ],
} as const

type ToggleKey = keyof typeof TOGGLES
type ToggleValue<K extends ToggleKey> = (typeof TOGGLES)[K][number]["key"]

export type ProtoState = {
  /** The current step's key (see `flowSteps`). */
  s: string
  marks: ToggleValue<"marks">
  gate: ToggleValue<"gate">
  at: ToggleValue<"at">
  friends: ToggleValue<"friends">
  /** Where the map starts: "you", a berlin area id, or "away:<name>". */
  loc: string
  /** After sign-up: the kept draft was lit, or put off with "not now". */
  flare: "lit" | "later"
  /** The draft's idea spot id, "none" for a blank draft (FAB, nav), or ""
   * for the nearest idea. */
  idea: string
}

export type ParamPatch = Partial<Record<keyof ProtoState, string>>

export type StepProps = {
  state: ProtoState
  now: number
  /** Go to a step, optionally setting other params on the way. */
  go: (step: string, patch?: ParamPatch) => void
  /** Stand-in for navigation the prototype doesn't do. */
  stub: (what: string) => void
}

export type Step = { key: string; label: string; stage: string }

export function PrototypeBar({
  state,
  steps,
  onChange,
}: {
  state: ProtoState
  steps: Step[]
  onChange: (next: ParamPatch) => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const index = Math.max(
    0,
    steps.findIndex((s) => s.key === state.s)
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowLeft")
        onChange({ s: steps[Math.max(0, index - 1)].key })
      if (e.key === "ArrowRight")
        onChange({ s: steps[Math.min(steps.length - 1, index + 1)].key })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const stages = steps.reduce<{ stage: string; steps: Step[] }[]>(
    (acc, step) => {
      const last = acc[acc.length - 1]
      if (last?.stage === step.stage) last.steps.push(step)
      else acc.push({ stage: step.stage, steps: [step] })
      return acc
    },
    []
  )

  return (
    <div className="space-y-1.5 bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-100">
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(TOGGLES) as ToggleKey[]).map((k) => (
          <Seg
            key={k}
            options={TOGGLES[k].map((o) => ({ key: o.key, label: o.label }))}
            value={state[k]}
            onChange={(v) => onChange({ [k]: v })}
          />
        ))}
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300"
        >
          {resolvedTheme === "dark" ? "dark" : "light"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-zinc-400">
          {index + 1}/{steps.length}
        </span>
        {stages.map((g) => (
          <span key={g.stage} className="flex items-center gap-1">
            <span className="text-zinc-500">{g.stage}</span>
            <Seg
              options={g.steps.map((s) => ({ key: s.key, label: s.label }))}
              value={state.s}
              onChange={(s) => onChange({ s })}
            />
          </span>
        ))}
      </div>
    </div>
  )
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap rounded-2xl bg-zinc-800 p-0.5">
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

// ---- Brand bits ------------------------------------------------------------

export function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
        <FlameIcon className="size-3.5" />
      </span>
      <span className="text-sm font-semibold">sponti</span>
    </div>
  )
}

/** The one peach button on a screen. */
export function PeachButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90",
        className
      )}
    >
      {children}
    </Button>
  )
}

/** The neutral button, for when peach is already on screen. */
export function InkButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 w-full rounded-full bg-foreground text-sm text-background hover:bg-foreground/90",
        className
      )}
    >
      {children}
    </Button>
  )
}

export function TextButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 w-full text-sm font-medium text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

export function Progress({ count, index }: { count: number; index: number }) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      aria-label="intro progress"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300",
            i <= index ? "bg-foreground" : "bg-border"
          )}
        />
      ))}
    </div>
  )
}

export function PersonAvatar({
  person,
  className,
}: {
  person: MockPerson
  className?: string
}) {
  return (
    <Avatar className={cn("size-8 border-2 border-card", className)}>
      <AvatarFallback
        className="text-xs text-foreground"
        style={{ backgroundColor: person.color }}
      >
        {initials(person.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function categoryOf(type: EventType): { Icon: Icon } {
  return { Icon: EVENT_TYPES.find((t) => t.value === type)?.icon ?? MapPinIcon }
}

export function SheetHandle() {
  return <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
}

/** A bottom sheet over the map, as the app draws them. */
export function Sheet({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "proto-up absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet)",
        className
      )}
    >
      <SheetHandle />
      {children}
    </div>
  )
}

// ---- Map backdrop ----------------------------------------------------------

export function MapGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 opacity-50", className)}
      style={{
        backgroundImage:
          "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  )
}

/** A couple of fake streets and the canal, so the backdrop reads as a map. */
export function MapStreets() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path
        d="M-5 62 C 20 55, 45 70, 70 58 S 105 50, 110 52"
        fill="none"
        stroke="var(--flare-open)"
        strokeOpacity="0.45"
        strokeWidth="10"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M10 -5 L 30 105 M 65 -5 L 55 105 M -5 25 L 105 35"
        fill="none"
        stroke="var(--card)"
        strokeWidth="6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Mirrors map-view's IdeaPinMark (not exported): dashed, muted, no peach. */
export function IdeaPin({
  idea,
  selected = false,
}: {
  idea: Pick<FlareIdea, "category">
  selected?: boolean
}) {
  const { Icon } = categoryOf(idea.category)
  return (
    <div className="flex items-center justify-center p-2">
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border border-dashed bg-muted text-muted-foreground shadow-md transition-transform",
          selected
            ? "scale-125 border-foreground/70 text-foreground"
            : "border-muted-foreground/70"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

export function UserDot() {
  return (
    <div className="h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
  )
}

type Spot = { top: string; left: string }
const PIN_SPOTS: Spot[] = [
  { top: "34%", left: "58%" },
  { top: "22%", left: "16%" },
  { top: "48%", left: "12%" },
]
const IDEA_SPOTS: Spot[] = [
  { top: "30%", left: "36%" },
  { top: "44%", left: "70%" },
  { top: "22%", left: "72%" },
]

/** The home map, as a static mock: the real header's pills, an area chip,
 * pins, idea spots, a dock, the FAB and a look-alike nav. Elements carry
 * `data-coach` so coach marks can find them. */
export function MapScreen({
  now,
  flares = [],
  own,
  ideas = [],
  areaLabel,
  located = true,
  signedIn = false,
  banner,
  dock,
  fab = true,
  selectedIdeaId,
  onIdea,
  onFlare,
  onAccountOnly,
  children,
}: {
  now: number
  flares?: EventItem[]
  /** The viewer's own flare, if lit. */
  own?: EventItem
  ideas?: FlareIdea[]
  /** The area chip: "near you", "kreuzberg", "berlin"… */
  areaLabel: string
  located?: boolean
  signedIn?: boolean
  banner?: React.ReactNode
  /** Replaces the default dock at the bottom of the map. */
  dock?: React.ReactNode
  fab?: boolean
  selectedIdeaId?: string
  onIdea?: (idea: FlareIdea) => void
  /** The FAB and the nav's flare button. */
  onFlare?: () => void
  /** Tabs and pills a signed-out visitor can't use yet. */
  onAccountOnly?: (what: string) => void
  children?: React.ReactNode
}) {
  const [view, setView] = useState<"map" | "calendar">("map")
  const pins = [...(own ? [own] : []), ...flares]
  return (
    <div
      data-coach-root
      className="relative flex h-dvh min-h-[640px] flex-col overflow-hidden bg-background"
    >
      <div className="relative flex-1 overflow-hidden bg-muted">
        {view === "map" ? (
          <>
            <MapGrid className="opacity-30" />
            <MapStreets />
            {located && (
              <div className="absolute top-[56%] left-1/2 -translate-x-1/2">
                <UserDot />
              </div>
            )}
            {ideas.slice(0, IDEA_SPOTS.length).map((idea, i) => (
              <button
                key={idea.id}
                type="button"
                aria-label={`idea: ${idea.title}`}
                onClick={() => onIdea?.(idea)}
                className="absolute"
                style={IDEA_SPOTS[i]}
                data-coach={i === 0 ? "spot" : undefined}
              >
                <IdeaPin idea={idea} selected={selectedIdeaId === idea.id} />
              </button>
            ))}
            {pins.slice(0, PIN_SPOTS.length).map((event, i) => (
              <div key={event.id} className="absolute" style={PIN_SPOTS[i]}>
                <FlarePin
                  event={event}
                  own={event.id === own?.id}
                  joined={false}
                  now={now}
                />
              </div>
            ))}
          </>
        ) : (
          <CalendarEmpty signedIn={signedIn} />
        )}

        <MapHeader
          view={view}
          onView={setView}
          signedIn={signedIn}
          onSignIn={() => onAccountOnly?.("sign in")}
        />
        {view === "map" && (
          <div className="absolute inset-x-0 top-14 flex flex-col gap-2 px-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow">
                {located ? (
                  <NavigationArrowIcon className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {areaLabel}
              </span>
              {pins.length > 0 && <VisibilityLegend />}
            </div>
            {banner}
          </div>
        )}

        {view === "map" && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col">
            {fab && (
              <div className="flex justify-end px-4 pb-3">
                <button
                  type="button"
                  data-coach="fab"
                  onClick={onFlare}
                  aria-label="light a flare"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:scale-95"
                >
                  <FlameIcon className="h-6 w-6" />
                </button>
              </div>
            )}
            {dock ?? <MapDock count={flares.length} ideas={ideas.length > 0} />}
          </div>
        )}
      </div>
      <MockNav
        onFlare={onFlare}
        onAccountOnly={signedIn ? undefined : onAccountOnly}
      />
      {children}
    </div>
  )
}

/** The real home header: menu, map/calendar, settings. A signed-out visitor
 * gets "sign in" where settings sits. */
function MapHeader({
  view,
  onView,
  signedIn,
  onSignIn,
}: {
  view: "map" | "calendar"
  onView: (v: "map" | "calendar") => void
  signedIn: boolean
  onSignIn: () => void
}) {
  const pill =
    "flex h-9 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md dark:bg-background/90"
  const tab = (v: "map" | "calendar", Icon: Icon, label: string) => (
    <button
      type="button"
      onClick={() => onView(v)}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm",
        view === v
          ? "bg-card font-semibold text-foreground"
          : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-3 pt-3">
      <span className={cn(pill, "w-9")} aria-label="menu">
        <ListIcon className="h-4 w-4" />
      </span>
      <div
        data-coach="calendar"
        className="flex items-center rounded-full border border-border/60 bg-background/70 p-1 shadow-sm backdrop-blur-md"
      >
        {tab("map", MapTrifoldIcon, "map")}
        {tab("calendar", CalendarBlankIcon, "calendar")}
      </div>
      {signedIn ? (
        <span className={cn(pill, "w-9")} aria-label="settings">
          <GearIcon className="h-4 w-4" />
        </span>
      ) : (
        <button
          type="button"
          data-coach="signin"
          onClick={onSignIn}
          className={cn(pill, "px-3 text-sm font-medium")}
        >
          sign in
        </button>
      )}
    </div>
  )
}

function CalendarEmpty({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background px-8 text-center">
      <CalendarBlankIcon className="size-6 text-muted-foreground" />
      <p className="mt-3 text-base font-semibold">nothing coming up yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {signedIn
          ? "flares with a picked time land here."
          : "flares with a picked time land here once you have friends on sponti."}
      </p>
    </div>
  )
}

/** The dock's sheet: a title, the live / soon / all tabs (the real
 * TimeTabs' labels) and one line. */
export function MapDock({
  count,
  ideas,
  title,
  hint,
}: {
  count: number
  ideas: boolean
  title?: string
  hint?: string
}) {
  const [tab, setTab] = useState("all")
  return (
    <div className="rounded-t-3xl bg-background px-4 pt-2 pb-4 shadow-(--shadow-sheet)">
      <SheetHandle />
      <p className="text-base font-semibold">
        {title ??
          (count > 0 ? `${count} flares near you` : "quiet around here")}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {hint ??
          (count > 0
            ? "live now and later today"
            : ideas
              ? "no flares yet. the dashed spots are ideas, tap one."
              : "no flares yet")}
      </p>
      <Tabs value={tab} onValueChange={setTab} data-coach="tabs">
        <TabsList className="mt-3 h-8 w-full">
          <TabsTrigger value="live" className="text-xs">
            live
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs">
            soon
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            all
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}

/** Look-alike of BottomNav (which needs the app's providers). The centre is
 * the real NavFlareButton. Not labelled "Primary", so screenshot CSS that
 * hides the real nav leaves it alone. */
export function MockNav({
  onFlare,
  onAccountOnly,
}: {
  onFlare?: () => void
  /** Set for a signed-out visitor: feed, circles and my flares need an
   * account. */
  onAccountOnly?: (what: string) => void
}) {
  const item = (Icon: Icon, label: string, active = false) => (
    <button
      type="button"
      onClick={() => !active && onAccountOnly?.(label)}
      className={cn(
        "relative flex min-h-11 max-w-20 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium",
        active ? "text-accent" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" weight={active ? "fill" : "regular"} />
      <span>{label}</span>
    </button>
  )
  return (
    <div
      aria-label="prototype nav"
      className="relative z-10 flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {item(HouseIcon, "home", true)}
      {item(BellIcon, "feed")}
      <span data-coach="flare" className="flex flex-1 self-stretch">
        <NavFlareButton onClick={() => onFlare?.()} />
      </span>
      {item(UsersIcon, "circles")}
      {item(FireIcon, "my flares")}
    </div>
  )
}

// ---- Fragments -------------------------------------------------------------

function Chip({
  children,
  selected = false,
}: {
  children: React.ReactNode
  selected?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs",
        selected
          ? "border-transparent bg-muted font-medium text-foreground"
          : "border-border text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

/** The composer's mode tabs, with the real labels. */
export function WhenTabs({
  value,
  onChange,
  className,
}: {
  value: "now" | "scheduled"
  onChange?: (v: "now" | "scheduled") => void
  className?: string
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange?.(v as "now" | "scheduled")}
      className={className}
    >
      <TabsList className="h-8 w-full">
        <TabsTrigger value="now" className="text-xs">
          right now
        </TabsTrigger>
        <TabsTrigger value="scheduled" className="text-xs">
          pick a time
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/** A compact look-alike of the composer: what, the when / where / who chips
 * and the right now / pick a time tabs. */
export function MiniComposer({
  title,
  type,
  where = "my location",
  who = "all friends",
  open = false,
  className,
}: {
  title?: string
  type: EventType
  where?: string
  who?: string
  open?: boolean
  className?: string
}) {
  const [mode, setMode] = useState<"now" | "scheduled">("now")
  const { Icon } = categoryOf(type)
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="size-4" />
        </span>
        <span
          className={cn(
            "text-sm",
            title ? "font-medium" : "text-muted-foreground"
          )}
        >
          {title ?? "what's the plan?"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip selected>
          <ClockIcon className="size-3.5" />
          {mode === "now" ? "now · 2h" : "tomorrow 18:00 · 2h"}
        </Chip>
        <Chip selected>
          <MapPinIcon className="size-3.5" />
          {where}
        </Chip>
        <Chip selected>
          {open ? (
            <GlobeIcon className="size-3.5" />
          ) : (
            <LockIcon className="size-3.5" />
          )}
          {who}
        </Chip>
      </div>
      <WhenTabs value={mode} onChange={setMode} />
    </div>
  )
}

/** Look-alike of calendar-view's EventCard (not exported). */
export function CalendarRow({
  event,
  day,
  time,
  className,
}: {
  event: EventItem
  day: string
  time: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
        className
      )}
    >
      <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
        {day}
        <br />
        {time}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {event.location.name.toLowerCase()} · {event.going} going
        </p>
      </div>
    </div>
  )
}

/** A friend's flare with its join button, and the joined state. */
export function JoinCard({
  event,
  host,
  joined,
  onJoin,
  goingPeople,
  className,
}: {
  event: EventItem
  host: MockPerson
  joined: boolean
  onJoin?: () => void
  goingPeople: MockPerson[]
  className?: string
}) {
  const { Icon } = categoryOf(event.type)
  return (
    <div
      className={cn(
        "rounded-2xl border border-l-[3px] border-border border-l-accent bg-background p-4 shadow-(--shadow-card)",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            event.visibility === "public"
              ? "bg-flare-open text-flare-open-ink"
              : "bg-flare-invite text-flare-invite-ink"
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{event.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            live · by {host.name.split(" ")[0].toLowerCase()} · 0.8 km
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {goingPeople.map((p) => (
            <PersonAvatar key={p.name} person={p} className="size-7" />
          ))}
          <span className="ml-3 self-center pl-2 text-xs text-muted-foreground">
            {event.going + (joined ? 1 : 0)} going
          </span>
        </div>
        {joined ? (
          <span className="inline-flex h-9 items-center gap-1 rounded-full bg-accent/15 px-3 text-xs font-medium text-accent">
            <CheckIcon className="size-3.5" weight="bold" />
            you&apos;re in
          </span>
        ) : (
          <Button
            type="button"
            onClick={onJoin}
            className="h-9 rounded-full bg-accent px-4 text-sm text-accent-foreground hover:bg-accent/90"
          >
            join
          </Button>
        )}
      </div>
    </div>
  )
}

/** A static pin on a little map patch, for slides. */
export function PinPatch({
  event,
  now,
  others = [],
  className,
}: {
  event: EventItem
  now: number
  others?: EventItem[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative h-44 overflow-hidden rounded-2xl border border-border bg-muted",
        className
      )}
    >
      <MapGrid className="opacity-30" />
      <MapStreets />
      {others.map((o, i) => (
        <div
          key={o.id}
          className="absolute opacity-80"
          style={
            [
              { top: "14%", left: "12%" },
              { top: "52%", left: "74%" },
            ][i]
          }
        >
          <FlarePin event={o} own={false} joined={false} now={now} />
        </div>
      ))}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <FlarePin event={event} own={false} joined={false} now={now} />
      </div>
    </div>
  )
}

/** Keyframes the screens use. Rendered once by the page. */
export function ProtoStyles() {
  return (
    <style>{`
      .proto-in { animation: proto-in 280ms cubic-bezier(0.32, 0.72, 0, 1); }
      @keyframes proto-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .proto-up { animation: proto-up 320ms cubic-bezier(0.32, 0.72, 0, 1); }
      @keyframes proto-up { from { transform: translateY(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
      .proto-coach-ring { animation: proto-coach-ring 1.8s ease-out infinite; }
      @keyframes proto-coach-ring { from { box-shadow: 0 0 0 0 var(--primary); } to { box-shadow: 0 0 0 12px transparent; } }
      @media (prefers-reduced-motion: reduce) {
        .proto-in, .proto-up, .proto-coach-ring { animation: none; }
      }
    `}</style>
  )
}

// ---- Coach marks -----------------------------------------------------------

type Rect = { top: number; left: number; width: number; height: number }

/**
 * Dims the screen except one element (found by `data-coach` inside the
 * nearest `[data-coach-root]`), with a card pointing at it. The spotlight is
 * a rounded box with a huge box-shadow; the card sits above or below it.
 */
export function CoachMark({
  target,
  index,
  count,
  title,
  body,
  onNext,
  onSkip,
}: {
  target: string
  index: number
  count: number
  title: string
  body: string
  onNext: () => void
  onSkip: () => void
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [rootH, setRootH] = useState(0)

  useLayoutEffect(() => {
    const root = host?.closest("[data-coach-root]") as HTMLElement | null
    if (!root) return
    const measure = () => {
      const el = root.querySelector(
        `[data-coach="${target}"]`
      ) as HTMLElement | null
      const r = root.getBoundingClientRect()
      setRootH(r.height)
      if (!el) return setRect(null)
      const t = el.getBoundingClientRect()
      setRect({
        top: t.top - r.top,
        left: t.left - r.left,
        width: t.width,
        height: t.height,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [host, target])

  const pad = 8
  const round = rect ? Math.abs(rect.width - rect.height) < 24 : true
  const box = rect
    ? round
      ? (() => {
          const size = Math.max(rect.width, rect.height) + pad * 2
          return {
            top: rect.top + rect.height / 2 - size / 2,
            left: rect.left + rect.width / 2 - size / 2,
            width: size,
            height: size,
          }
        })()
      : {
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }
    : null
  const below = box ? box.top + box.height / 2 < rootH / 2 : true
  const last = index === count - 1

  return (
    <div
      ref={setHost}
      className="absolute inset-0 z-30"
      role="dialog"
      aria-label={title}
    >
      {box && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute",
            round ? "rounded-full" : "rounded-2xl"
          )}
          style={{
            ...box,
            boxShadow: "0 0 0 200vmax oklch(0.15 0.02 266 / 0.62)",
          }}
        >
          <span
            className={cn(
              "proto-coach-ring absolute inset-0",
              round ? "rounded-full" : "rounded-2xl"
            )}
          />
        </div>
      )}
      {box && (
        <div
          key={target}
          className="proto-in absolute inset-x-4 rounded-2xl bg-card p-4 shadow-xl"
          style={
            below
              ? { top: box.top + box.height + 12 }
              : { bottom: rootH - box.top + 12 }
          }
        >
          <p className="text-xs text-muted-foreground">
            {index + 1} of {count}
          </p>
          <p className="mt-1 text-base font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onSkip}
              className="min-h-11 text-sm font-medium text-muted-foreground"
            >
              skip
            </button>
            <Button
              type="button"
              onClick={onNext}
              className="h-10 rounded-full bg-foreground px-5 text-sm text-background hover:bg-foreground/90"
            >
              {last ? "got it" : "next"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
