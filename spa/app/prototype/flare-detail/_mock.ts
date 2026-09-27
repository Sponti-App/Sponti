// PROTOTYPE (#162) — throwaway. Local mock data for the flare detail layout
// prototypes. Nothing here talks to the api; delete with the route once a
// layout is chosen.

import type { LucideIcon } from "lucide-react"
import { EVENT_TYPES } from "@/types/utils"

export type Viewer = "host" | "joined" | "invited"
export type Timing = "live" | "upcoming"

export const VIEWERS: { key: Viewer; label: string }[] = [
  { key: "host", label: "host" },
  { key: "joined", label: "joined" },
  { key: "invited", label: "invited" },
]
export const TIMINGS: { key: Timing; label: string }[] = [
  { key: "live", label: "live" },
  { key: "upcoming", label: "upcoming" },
]

export type MockPerson = {
  id: string
  displayName: string
  username: string
  avatarUrl: null
}

export type MockGuest = MockPerson & {
  rsvp: "going" | "invited" | "declined"
  /** Only ever present for the host (the api strips it for everyone else). */
  willArriveAt?: string
  plusOne?: boolean
  isYou?: boolean
}

export type MockUpdate = {
  id: string
  kind: "message" | "activity"
  author: MockPerson
  text: string
  at: string
}

export type MockFlare = {
  id: string
  title: string
  description: string
  category: (typeof EVENT_TYPES)[number]["value"]
  visibility: "private" | "public"
  allowPlusOne: boolean
  host: MockPerson
  startAt: string
  endAt: string
  place: {
    name: string
    address: string
    distance: string
    travel: string
  }
  guests: MockGuest[]
  updates: MockUpdate[]
}

const MIN = 60_000

const person = (id: string, displayName: string, username: string) => ({
  id,
  displayName,
  username,
  avatarUrl: null,
})

const HOST = person("u-host", "Sarah Kim", "sarahk")
const YOU_GUEST = person("u-you", "Alex Rivera", "alexr")
const MAYA = person("u-maya", "Maya Chen", "mayac")
const JONAS = person("u-jonas", "Jonas Weber", "jonasw")
const PRIYA = person("u-priya", "Priya Shah", "priyas")
const TOM = person("u-tom", "Tom Okafor", "tomo")
const LEO = person("u-leo", "Leo Martin", "leom")
const ANA = person("u-ana", "Ana Silva", "anas")

const iso = (ms: number) => new Date(ms).toISOString()

/**
 * One flare, seen by three viewers at two moments. Times are relative to
 * `now` so "live" is always live and "upcoming" always tomorrow evening.
 */
export function buildFlare(
  viewer: Viewer,
  timing: Timing,
  myEtaMin: number,
  now: number
): MockFlare {
  const live = timing === "live"
  const startAt = live ? now - 25 * MIN : tomorrowAt(now, 19, 30)
  const endAt = live ? now + 95 * MIN : startAt + 3 * 60 * MIN
  const eta = (min: number) => (live ? iso(now + min * MIN) : undefined)

  const going: MockGuest[] = [
    { ...JONAS, rsvp: "going", willArriveAt: eta(-8) },
    { ...MAYA, rsvp: "going", willArriveAt: eta(5), plusOne: true },
    { ...PRIYA, rsvp: "going", willArriveAt: eta(25) },
    { ...TOM, rsvp: "going", willArriveAt: eta(50) },
  ]
  if (viewer === "joined") {
    going.push({
      ...YOU_GUEST,
      rsvp: "going",
      willArriveAt: eta(myEtaMin),
      isYou: true,
    })
  }
  const others: MockGuest[] = [
    ...(viewer === "invited" ? [{ ...YOU_GUEST, rsvp: "invited" as const, isYou: true }] : []),
    { ...LEO, rsvp: "invited" },
    { ...ANA, rsvp: "declined" },
  ]

  // Guests never get ETAs — mirror the api, which only sends willArriveAt
  // to the host.
  const guests = [...going, ...others].map((g) =>
    viewer === "host" || g.isYou ? g : { ...g, willArriveAt: undefined }
  )

  const updates: MockUpdate[] = live
    ? [
        activity("a1", HOST, "lit this flare", now - 70 * MIN),
        activity("a2", JONAS, "joined", now - 55 * MIN),
        activity("a3", MAYA, "joined with a +1", now - 40 * MIN),
        message("m1", HOST, "got the big table at the back, left of the bar", now - 20 * MIN),
        message("m2", PRIYA, "running a bit late, save me a seat", now - 6 * MIN),
      ]
    : [
        activity("a1", HOST, "lit this flare", now - 3 * 60 * MIN),
        activity("a2", JONAS, "joined", now - 2 * 60 * MIN),
        activity("a3", MAYA, "joined with a +1", now - 90 * MIN),
        message("m1", HOST, "booked a table for 8, come whenever", now - 45 * MIN),
      ]

  return {
    id: "proto-flare",
    title: "after-work pints",
    description:
      "end of the week, grabbing a table at the harp. come as you are, first round's on me.",
    category: "drinks",
    visibility: "private",
    allowPlusOne: true,
    host: HOST,
    startAt: iso(startAt),
    endAt: iso(endAt),
    place: {
      name: "the harp",
      address: "47 chandos pl, covent garden",
      distance: "0.6 mi",
      travel: "12 min walk",
    },
    guests,
    updates,
  }
}

function activity(id: string, author: MockPerson, text: string, at: number): MockUpdate {
  return { id, kind: "activity", author, text, at: iso(at) }
}
function message(id: string, author: MockPerson, text: string, at: number): MockUpdate {
  return { id, kind: "message", author, text, at: iso(at) }
}

function tomorrowAt(now: number, h: number, m: number): number {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

// ---- derived helpers shared by the variants -------------------------------

export const ETA_OPTIONS = [5, 15, 30, 60]

export function etaLabel(min: number): string {
  return min >= 60 ? "1 hr" : `${min} min`
}

export function goingGuests(flare: MockFlare): MockGuest[] {
  return flare.guests.filter((g) => g.rsvp === "going")
}

/** +1s count towards the going total (#159 decision). */
export function goingCount(flare: MockFlare): number {
  return goingGuests(flare).reduce((n, g) => n + (g.plusOne ? 2 : 1), 0)
}

/** Host-facing: going guests sorted by who arrives first. */
export function byArrival(guests: MockGuest[]): MockGuest[] {
  return [...guests].sort((a, b) => {
    const ta = a.willArriveAt ? new Date(a.willArriveAt).getTime() : Infinity
    const tb = b.willArriveAt ? new Date(b.willArriveAt).getTime() : Infinity
    return ta - tb
  })
}

export function categoryOf(flare: MockFlare): { label: string; icon: LucideIcon } {
  const t = EVENT_TYPES.find((x) => x.value === flare.category) ?? EVENT_TYPES[0]
  return { label: t.label, icon: t.icon }
}

/**
 * PLACEHOLDER for #138: a per-category tint. Subtle, never peach (peach is
 * the CTA colour). The real mapping is a design-system decision for BRAND.md.
 */
export const CATEGORY_TINT: Record<string, { bg: string; fg: string }> = {
  drinks: {
    bg: "oklch(0.72 0.12 330 / 0.16)",
    fg: "oklch(0.55 0.14 330)",
  },
}

export function tintFor(flare: MockFlare) {
  return (
    CATEGORY_TINT[flare.category] ?? {
      bg: "var(--muted)",
      fg: "var(--muted-foreground)",
    }
  )
}

// ---- time copy (BRAND: time is human) --------------------------------------

export function clock(isoValue: string): string {
  const d = new Date(isoValue)
  const hour = d.getHours() % 12 || 12
  const minute = String(d.getMinutes()).padStart(2, "0")
  return `${hour}:${minute}${d.getHours() >= 12 ? "pm" : "am"}`
}

export function dayLabel(isoValue: string, now: number): string {
  const d = new Date(isoValue)
  const n = new Date(now)
  const sameDay = d.toDateString() === n.toDateString()
  const t = new Date(now)
  t.setDate(t.getDate() + 1)
  if (sameDay) return "today"
  if (d.toDateString() === t.toDateString()) return "tomorrow"
  return d
    .toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
    .toLowerCase()
}

export function span(min: number): string {
  const m = Math.max(1, Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}

/** "live · ends in 1h 35m" / "tomorrow · 7:30pm" */
export function statusLine(flare: MockFlare, now: number): string {
  const start = new Date(flare.startAt).getTime()
  const end = new Date(flare.endAt).getTime()
  if (start <= now && now < end) return `live · ends in ${span((end - now) / MIN)}`
  return `${dayLabel(flare.startAt, now)} · ${clock(flare.startAt)}`
}

export function isLive(flare: MockFlare, now: number): boolean {
  const start = new Date(flare.startAt).getTime()
  return start <= now && now < new Date(flare.endAt).getTime()
}

export function startsIn(flare: MockFlare, now: number): string {
  return `in ${span((new Date(flare.startAt).getTime() - now) / MIN)}`
}

export function ago(isoValue: string, now: number): string {
  const min = Math.round((now - new Date(isoValue).getTime()) / MIN)
  if (min < 1) return "now"
  if (min < 60) return `${min}m`
  return `${Math.round(min / 60)}h`
}

/** Compact arrival copy for tight rows: "here", "5 min", "50 min". */
export function arrivalShort(willArriveAt: string, now: number): string {
  const min = Math.round((new Date(willArriveAt).getTime() - now) / MIN)
  if (min <= 0) return "there"
  return span(min)
}
