// PROTOTYPE (#374) — throwaway. Knobs and local mock data for the first-join
// moment. Nothing here talks to the api or auth-server; delete with the route
// once a pattern is picked.

import { WineIcon, type Icon } from "@/components/icons"

/** How the first join plays. */
export type Overlay = "card" | "arc" | "banner"
/** Total length of the first-join moment. */
export type Length = "short" | "long"
/** What the overlay says. */
export type Shows = "name" | "flare" | "eta"
/** What a later join (2nd, 3rd …) gets. */
export type Later = "swing" | "puff"
/** Where the host is when the poll brings the join in. */
export type Where = "map" | "sheet" | "calendar" | "started"
/**
 * The event detail sheet today covers the nav (fixed bottom-0, z-50, a
 * full-screen scrim), so the bell is hidden while it's open. "under" keeps
 * that and lands the moment in the sheet's going row; "above" lifts the
 * sheet above the nav, like the feed sheet already sits.
 */
export type SheetNav = "under" | "above"
/** How many friends the same poll brings in. */
export type Batch = "1" | "2" | "3"
/** One overlay for everyone in a poll, or the first then quick puffs. */
export type Batching = "stack" | "queue"
/** The bell's unread badge: today's dot, or a count. */
export type Badge = "dot" | "count"
export type Motion = "system" | "reduce" | "full"
/** "real" waits like the 30 s unread poll would (3–30 s); "now" is instant. */
export type Poll = "now" | "real"

export type Settings = {
  overlay: Overlay
  length: Length
  shows: Shows
  later: Later
  where: Where
  sheet: SheetNav
  batch: Batch
  batching: Batching
  badge: Badge
  motion: Motion
  poll: Poll
}

type Opt<T extends string> = readonly { key: T; label: string }[]

export const OVERLAYS: Opt<Overlay> = [
  { key: "card", label: "A card" },
  { key: "arc", label: "B arc" },
  { key: "banner", label: "C banner" },
]
export const LENGTHS: Opt<Length> = [
  { key: "short", label: "1.2s" },
  { key: "long", label: "2.5s" },
]
export const SHOWS: Opt<Shows> = [
  { key: "name", label: "name" },
  { key: "flare", label: "+flare" },
  { key: "eta", label: "+eta" },
]
export const LATERS: Opt<Later> = [
  { key: "swing", label: "swing" },
  { key: "puff", label: "avatar puff" },
]
export const WHERES: Opt<Where> = [
  { key: "map", label: "map" },
  { key: "sheet", label: "detail" },
  { key: "calendar", label: "calendar" },
  { key: "started", label: "started" },
]
export const SHEET_NAVS: Opt<SheetNav> = [
  { key: "under", label: "nav hidden (today)" },
  { key: "above", label: "sheet above nav" },
]
export const BATCHES: Opt<Batch> = [
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
]
export const BATCHINGS: Opt<Batching> = [
  { key: "stack", label: "stack" },
  { key: "queue", label: "queue" },
]
export const BADGES: Opt<Badge> = [
  { key: "dot", label: "dot" },
  { key: "count", label: "count" },
]
export const MOTIONS: Opt<Motion> = [
  { key: "system", label: "system" },
  { key: "reduce", label: "reduce" },
  { key: "full", label: "full" },
]
export const POLLS: Opt<Poll> = [
  { key: "now", label: "now" },
  { key: "real", label: "≤30s" },
]

export const DEFAULTS: Settings = {
  overlay: "card",
  length: "short",
  shows: "flare",
  later: "swing",
  where: "map",
  sheet: "under",
  batch: "1",
  batching: "stack",
  badge: "dot",
  motion: "system",
  poll: "now",
}

/** Seconds per phase. Short ≈ 1.2 s end to end, long ≈ 2.5 s. */
export const TIMING: Record<
  Length,
  { in: number; hold: number; fly: number; land: number }
> = {
  short: { in: 0.28, hold: 0.32, fly: 0.45, land: 0.15 },
  long: { in: 0.4, hold: 1.35, fly: 0.6, land: 0.15 },
}

// --- people ---------------------------------------------------------------

export type Person = {
  id: string
  name: string
  initials: string
  /** Avatar fill, tokens only (host colours are a later decision). */
  tone: string
  /** Minutes until they arrive (host-only data, see #90). */
  etaMin: number
}

export const PEOPLE: Person[] = [
  {
    id: "mia",
    name: "mia",
    initials: "m",
    tone: "bg-flare-open text-flare-open-ink",
    etaMin: 12,
  },
  {
    id: "jonas",
    name: "jonas",
    initials: "j",
    tone: "bg-flare-invite text-flare-invite-ink",
    etaMin: 20,
  },
  {
    id: "lea",
    name: "lea",
    initials: "l",
    tone: "bg-secondary text-secondary-foreground",
    etaMin: 5,
  },
  {
    id: "sam",
    name: "sam",
    initials: "s",
    tone: "bg-muted text-foreground",
    etaMin: 30,
  },
]

export const MOCK_FLARE: {
  title: string
  place: string
  icon: Icon
  startsIn: string
  liveFor: string
} = {
  title: "sunset drinks",
  place: "klunkerkranich",
  icon: WineIcon,
  startsIn: "in 25 min",
  liveFor: "ending in 1h 40m",
}

/** "mia", "mia and jonas", "mia, jonas and lea". */
export function names(people: Person[]): string {
  const n = people.map((p) => p.name)
  if (n.length <= 1) return n[0] ?? ""
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`
}

/** The overlay's lines for these joiners, per the "shows" knob. */
export function overlayCopy(
  people: Person[],
  shows: Shows,
  started: boolean
): { title: string; detail: string | null } {
  const title = `${names(people)} joined your flare`
  if (shows === "name") return { title, detail: null }
  const flare = MOCK_FLARE.title
  if (shows === "flare") return { title, detail: flare }
  const eta =
    people.length === 1
      ? started
        ? `on the way · ${people[0].etaMin} min`
        : `arriving in ${people[0].etaMin} min`
      : `${people.length} on the way`
  return { title, detail: `${flare} · ${eta}` }
}
