"use client"

// PROTOTYPE (#373) — throwaway. Atoms shared by the intro variants: the
// prototype bar, brand bits, the mock map screen with its nav, the small UI
// fragments the intro cards show (composer, join, fuse) and the coach mark
// overlay. Real components where cheap (FlarePin, NavFlareButton, Button,
// VisibilityLegend); everything else is a look-alike on mock data.

import { useEffect, useLayoutEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  BellIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  ClockIcon,
  FireIcon,
  FlameIcon,
  GlobeIcon,
  HouseIcon,
  LockIcon,
  MapPinIcon,
  NavigationArrowIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons"
import { NavFlareButton } from "@/components/bottom-nav"
import { initials } from "@/components/event-avatar-stack"
import { FlarePin, VisibilityLegend } from "@/components/map-flare-pin"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { EventItem, EventType } from "@/lib/api/events"
import type { FlareIdea } from "@/lib/flare-ideas"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"
import type { MockPerson } from "./_mock"

// ---- Prototype state -------------------------------------------------------

export const SECTIONS = [
  { key: "welcome", name: "1 · /welcome" },
  { key: "location", name: "2 · location ask" },
  { key: "intro", name: "3 · after sign-up" },
  { key: "coach", name: "4 · coach marks" },
] as const
export type Section = (typeof SECTIONS)[number]["key"]

export const VARIANTS: Record<
  Section,
  readonly { key: string; label: string }[]
> = {
  welcome: [
    { key: "A", label: "a cards" },
    { key: "B", label: "b story" },
    { key: "C", label: "c try it" },
  ],
  location: [
    { key: "A", label: "a own screen" },
    { key: "B", label: "b on the map" },
  ],
  intro: [
    { key: "now", label: "today" },
    { key: "A", label: "a one screen" },
    { key: "B", label: "b checklist" },
  ],
  coach: [
    { key: "after", label: "after location" },
    { key: "before", label: "before location" },
  ],
}

export type ProtoState = {
  section: Section
  v: string
  s: number
  cards: "3" | "4"
  friends: "0" | "3"
  spot: "idea" | "pin"
}

export type StepProps = {
  state: ProtoState
  now: number
  go: (s: number) => void
  /** Stand-in for navigation the prototype doesn't do. */
  stub: (what: string) => void
}

export function PrototypeBar({
  state,
  steps,
  onChange,
}: {
  state: ProtoState
  steps: number
  onChange: (next: Partial<Record<keyof ProtoState, string>>) => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const variants = VARIANTS[state.section]
  const vIndex = Math.max(
    0,
    variants.findIndex((v) => v.key === state.v)
  )
  const cycle = (dir: 1 | -1) =>
    onChange({
      v: variants[(vIndex + dir + variants.length) % variants.length].key,
      s: "0",
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowLeft")
        onChange({ s: String(Math.max(0, state.s - 1)) })
      if (e.key === "ArrowRight")
        onChange({ s: String(Math.min(steps - 1, state.s + 1)) })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="space-y-1 bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-100">
      <Seg
        options={SECTIONS.map((s) => ({ key: s.key, label: s.name }))}
        value={state.section}
        onChange={(section) =>
          onChange({ section, v: VARIANTS[section][0].key, s: "0" })
        }
      />
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => cycle(-1)}
          aria-label="previous variant"
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <CaretLeftIcon className="h-4 w-4" />
        </button>
        <Seg
          options={variants.map((v) => ({ key: v.key, label: v.label }))}
          value={variants[vIndex].key}
          onChange={(v) => onChange({ v, s: "0" })}
        />
        <button
          type="button"
          onClick={() => cycle(1)}
          aria-label="next variant"
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <CaretRightIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-400">
          step {state.s + 1}/{steps}
        </span>
        <Seg
          options={Array.from({ length: steps }, (_, i) => ({
            key: String(i),
            label: String(i + 1),
          }))}
          value={String(state.s)}
          onChange={(s) => onChange({ s })}
        />
        {state.section === "welcome" && state.v === "A" && (
          <Seg
            options={[
              { key: "3", label: "3 cards" },
              { key: "4", label: "4 cards" },
            ]}
            value={state.cards}
            onChange={(cards) => onChange({ cards, s: "0" })}
          />
        )}
        {state.section === "intro" && state.v !== "now" && (
          <Seg
            options={[
              { key: "0", label: "0 friends" },
              { key: "3", label: "3 friends" },
            ]}
            value={state.friends}
            onChange={(friends) => onChange({ friends, s: "0" })}
          />
        )}
        {state.section === "coach" && (
          <Seg
            options={[
              { key: "idea", label: "idea spots" },
              { key: "pin", label: "flares" },
            ]}
            value={state.spot}
            onChange={(spot) => onChange({ spot })}
          />
        )}
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300"
        >
          {resolvedTheme === "dark" ? "dark" : "light"}
        </button>
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
  value: T
  onChange: (v: T) => void
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

/** The neutral "next" button the current first-run intro uses. */
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

/** The end of every /welcome variant: the real build links to /register and
 * /login. */
export function AuthCtas({ stub }: { stub: (what: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <PeachButton onClick={() => stub("→ /register")}>
        create an account
      </PeachButton>
      <TextButton onClick={() => stub("→ /login")}>
        i have an account
      </TextButton>
    </div>
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
          "flex h-7 w-7 items-center justify-center rounded-full border border-dashed bg-muted text-muted-foreground shadow-md",
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
  { top: "30%", left: "58%" },
  { top: "18%", left: "16%" },
  { top: "46%", left: "12%" },
]
const IDEA_SPOTS: Spot[] = [
  { top: "26%", left: "40%" },
  { top: "44%", left: "70%" },
  { top: "16%", left: "72%" },
]

/** The home map, as a static mock: header chip, legend, pins, idea spots and
 * a look-alike bottom nav. Elements carry `data-coach` so coach marks can find
 * them. */
export function MapScreen({
  now,
  flares = [],
  ideas = [],
  areaLabel,
  located = true,
  banner,
  dock,
  children,
  className,
}: {
  now: number
  flares?: EventItem[]
  ideas?: FlareIdea[]
  /** The header chip: "kreuzberg", "near you"… */
  areaLabel: string
  located?: boolean
  banner?: React.ReactNode
  /** Replaces the default sheet peek at the bottom of the map. */
  dock?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex h-dvh min-h-[600px] flex-col overflow-hidden bg-background",
        className
      )}
    >
      <div className="relative flex-1 overflow-hidden bg-muted">
        <MapGrid className="opacity-30" />
        <MapStreets />
        <div className="absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow">
              {located ? (
                <NavigationArrowIcon className="h-3.5 w-3.5 text-accent" />
              ) : (
                <MapPinIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {areaLabel}
            </span>
            {flares.length > 0 && <VisibilityLegend />}
          </div>
          {banner}
        </div>
        {located && (
          <div className="absolute top-[52%] left-1/2 -translate-x-1/2">
            <UserDot />
          </div>
        )}
        {ideas.slice(0, IDEA_SPOTS.length).map((idea, i) => (
          <div
            key={idea.id}
            className="absolute"
            style={IDEA_SPOTS[i]}
            data-coach={i === 0 && flares.length === 0 ? "spot" : undefined}
          >
            <IdeaPin idea={idea} />
          </div>
        ))}
        {flares.slice(0, PIN_SPOTS.length).map((event, i) => (
          <div
            key={event.id}
            className="absolute"
            style={PIN_SPOTS[i]}
            data-coach={i === 0 ? "spot" : undefined}
          >
            <FlarePin event={event} own={false} joined={false} now={now} />
          </div>
        ))}
        {dock ?? <MapDock flares={flares} ideas={ideas} />}
      </div>
      <MockNav />
      {children}
    </div>
  )
}

function MapDock({
  flares,
  ideas,
}: {
  flares: EventItem[]
  ideas: FlareIdea[]
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background px-4 pt-2 pb-4 shadow-(--shadow-sheet)">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
      <p className="text-base font-semibold">
        {flares.length > 0 ? `${flares.length} flares near you` : "quiet map"}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {flares.length > 0
          ? "live now and later today"
          : ideas.length > 0
            ? "no flares yet. the dashed spots are ideas, tap one to light it."
            : "no flares yet"}
      </p>
    </div>
  )
}

/** Look-alike of BottomNav (which needs the app's providers). The centre is
 * the real NavFlareButton. Not labelled "Primary", so screenshot CSS that
 * hides the real nav leaves it alone. */
export function MockNav() {
  const item = (Icon: Icon, label: string, coach?: string, active = false) => (
    <span
      data-coach={coach}
      className={cn(
        "relative flex min-h-11 max-w-20 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium",
        active ? "text-accent" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" weight={active ? "fill" : "regular"} />
      <span>{label}</span>
    </span>
  )
  return (
    <div
      aria-label="prototype nav"
      className="relative z-10 flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {item(HouseIcon, "home", undefined, true)}
      {item(BellIcon, "feed", "bell")}
      <span data-coach="flare" className="flex flex-1 self-stretch">
        <NavFlareButton onClick={() => {}} />
      </span>
      {item(UsersIcon, "circles")}
      {item(FireIcon, "my flares")}
    </div>
  )
}

// ---- Fragments shown on intro cards ---------------------------------------

function Chip({
  children,
  selected = false,
  onClick,
}: {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
}) {
  const Tag = onClick ? "button" : "span"
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs",
        selected
          ? "border-transparent bg-muted font-medium text-foreground"
          : "border-border text-muted-foreground"
      )}
    >
      {children}
    </Tag>
  )
}

/** A compact look-alike of the composer: what, when, where, who. */
export function MiniComposer({
  title,
  type,
  when = "now · 2h",
  where = "my location",
  who = "all friends",
  open = false,
  cta,
  className,
}: {
  title?: string
  type: EventType
  when?: string
  where?: string
  who?: string
  open?: boolean
  cta?: React.ReactNode
  className?: string
}) {
  const { Icon } = categoryOf(type)
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-(--shadow-card)",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
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
          {when}
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
      {cta}
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
      {joined && (
        <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {host.name.split(" ")[0].toLowerCase()} sees you&apos;re 12 min away
        </p>
      )}
    </div>
  )
}

/** A static pin on a little map patch, for intro cards. */
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

/**
 * The fuse, borrowed from #371 as plain CSS: a ring runs around the
 * category icon, then the flare bursts alight. `lit` false shows the unlit
 * icon; flipping it to true plays the fuse once. Reduced motion skips the
 * travel and just cross-fades.
 */
export function Fuse({
  type,
  lit,
  size = 112,
}: {
  type: EventType
  lit: boolean
  size?: number
}) {
  const { Icon } = categoryOf(type)
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      data-lit={lit ? "true" : "false"}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="var(--border)"
          strokeWidth="2"
          strokeDasharray="2 4"
        />
        {lit && (
          <circle
            key="fuse"
            className="proto-fuse"
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
          />
        )}
      </svg>
      {lit && (
        <span
          aria-hidden="true"
          className="proto-spark absolute inset-0"
          style={{ ["--r" as string]: `${size / 2 - 4}px` }}
        >
          <span className="absolute top-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_var(--primary)]" />
        </span>
      )}
      <div
        className={cn(
          "absolute inset-3 flex items-center justify-center rounded-full",
          lit
            ? "proto-burst bg-accent text-accent-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-1/2 w-1/2" />
      </div>
    </div>
  )
}

/** Keyframes the fragments use. Rendered once by the page. */
export function ProtoStyles() {
  return (
    <style>{`
      .proto-fuse { stroke-dasharray: 1; stroke-dashoffset: 1; animation: proto-fuse 1.2s linear forwards; }
      @keyframes proto-fuse { to { stroke-dashoffset: 0; } }
      .proto-spark { animation: proto-spark 1.2s linear forwards; }
      @keyframes proto-spark { from { transform: rotate(0deg); opacity: 1; } 95% { opacity: 1; } to { transform: rotate(360deg); opacity: 0; } }
      .proto-burst { animation: proto-burst 420ms cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s both; }
      @keyframes proto-burst { from { transform: scale(0.85); background: var(--muted); color: var(--muted-foreground); } to { transform: none; } }
      .proto-in { animation: proto-in 280ms cubic-bezier(0.32, 0.72, 0, 1); }
      @keyframes proto-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .proto-coach-ring { animation: proto-coach-ring 1.8s ease-out infinite; }
      @keyframes proto-coach-ring { from { box-shadow: 0 0 0 0 var(--primary); } to { box-shadow: 0 0 0 12px transparent; } }
      @media (prefers-reduced-motion: reduce) {
        .proto-fuse { animation: none; stroke-dashoffset: 0; }
        .proto-spark { display: none; }
        .proto-burst { animation: proto-fade 200ms both; }
        .proto-in, .proto-coach-ring { animation: none; }
        @keyframes proto-fade { from { opacity: 0; } to { opacity: 1; } }
      }
    `}</style>
  )
}

// ---- Coach marks -----------------------------------------------------------

type Rect = { top: number; left: number; width: number; height: number }

/**
 * Dims the screen except one element (found by `data-coach` inside the
 * nearest `[data-coach-root]`), with a card pointing at it. The spotlight is
 * a circle with a huge box-shadow; the card sits above or below the target.
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

  const size = rect ? Math.max(rect.width, rect.height) + 16 : 0
  const cx = rect ? rect.left + rect.width / 2 : 0
  const cy = rect ? rect.top + rect.height / 2 : 0
  const below = rect ? cy < rootH / 2 : true
  const last = index === count - 1

  return (
    <div
      ref={setHost}
      className="absolute inset-0 z-20"
      role="dialog"
      aria-label={title}
    >
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            top: cy - size / 2,
            left: cx - size / 2,
            width: size,
            height: size,
            boxShadow: "0 0 0 200vmax oklch(0.15 0.02 266 / 0.62)",
          }}
        >
          <span className="proto-coach-ring absolute inset-0 rounded-full" />
        </div>
      )}
      {rect && (
        <div
          key={target}
          className="proto-in absolute inset-x-4 rounded-2xl bg-card p-4 shadow-xl"
          style={
            below
              ? { top: cy + size / 2 + 12 }
              : { bottom: rootH - (cy - size / 2) + 12 }
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
