"use client"

// PROTOTYPE (#374) — throwaway. Mock app screens the host can be on when a
// join lands: the home map, the event detail sheet of the flare, the
// calendar, and the map after the flare started. Plus a stand-in for the
// bottom nav that matches BottomNav's markup (the real one needs the drawer
// provider, the router and live flares) and reuses its NavFlareButton.

import { NavFlareButton } from "@/components/bottom-nav"
import {
  BarbellIcon,
  BellIcon,
  ClockIcon,
  ForkKnifeIcon,
  HouseIcon,
  MapPinIcon,
  PaletteIcon,
  UsersIcon,
  FireIcon,
  type Icon,
} from "@/components/icons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { MOCK_FLARE, type Badge, type Person, type SheetNav } from "./_mock"

/** The elements the timelines move or hit, filled by ref callbacks. */
export type TargetRefs = {
  bell: HTMLElement | null
  bellRipple: HTMLElement | null
  badge: HTMLElement | null
  slot: HTMLElement | null
  slotRipple: HTMLElement | null
}
/** Ref callback factory: `reg("bell")` stores the node under "bell". */
export type Reg = (key: keyof TargetRefs) => (n: HTMLElement | null) => void

// --- avatars --------------------------------------------------------------

const SIZES = {
  xs: "size-6 text-xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-18 text-lg",
} as const

export function PersonAvatar({
  person,
  size = "sm",
  className,
}: {
  person: Person
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      <AvatarFallback className={cn("font-semibold", SIZES[size], person.tone)}>
        {person.initials}
      </AvatarFallback>
    </Avatar>
  )
}

/** Overlapping avatars, first on top. */
export function AvatarStack({
  people,
  size = "sm",
  ring = "ring-2 ring-card",
}: {
  people: Person[]
  size?: keyof typeof SIZES
  ring?: string
}) {
  return (
    <div className="flex shrink-0 items-center">
      {people.map((p, i) => (
        <PersonAvatar
          key={p.id}
          person={p}
          size={size}
          className={cn(ring, i > 0 && "-ml-3")}
        />
      ))}
    </div>
  )
}

// --- bottom nav -----------------------------------------------------------

export function MockNav({
  unread,
  badge,
  reg,
  navRef,
}: {
  unread: number
  badge: Badge
  reg: Reg
  navRef: React.Ref<HTMLElement>
}) {
  const plain: { icon: Icon; label: string; active?: boolean }[] = [
    { icon: UsersIcon, label: "circles" },
    { icon: FireIcon, label: "my flares" },
  ]
  return (
    <nav
      ref={navRef}
      aria-label="primary (mock)"
      className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <NavItem icon={HouseIcon} label="home" active />
      <button
        type="button"
        aria-label="feed"
        className="relative flex min-h-11 max-w-20 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium text-muted-foreground"
      >
        <span className="relative flex">
          <span
            ref={reg("bellRipple")}
            aria-hidden
            className="pointer-events-none absolute -inset-2 rounded-full border-2 border-primary opacity-0"
          />
          <span ref={reg("bell")} className="flex">
            <BellIcon className="h-5 w-5" />
          </span>
        </span>
        <span>feed</span>
        <span
          ref={reg("badge")}
          aria-label={unread > 0 ? `${unread} unread` : undefined}
          className={cn(
            "absolute left-1/2 rounded-full bg-accent",
            badge === "dot"
              ? "top-1 ml-1.5 h-1.5 w-1.5"
              : "top-0 ml-1 flex h-4 min-w-4 items-center justify-center px-1 text-xs leading-none font-semibold text-accent-foreground",
            unread === 0 && "invisible"
          )}
        >
          {badge === "count" && unread > 0 ? unread : null}
        </span>
      </button>
      <NavFlareButton onClick={() => {}} />
      {plain.map((p) => (
        <NavItem key={p.label} icon={p.icon} label={p.label} />
      ))}
    </nav>
  )
}

function NavItem({
  icon: I,
  label,
  active,
}: {
  icon: Icon
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative flex min-h-11 max-w-20 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium",
        active ? "text-accent" : "text-muted-foreground"
      )}
    >
      <I className="h-5 w-5" weight={active ? "fill" : "regular"} />
      <span>{label}</span>
    </button>
  )
}

// --- shared bits ----------------------------------------------------------

function ModeChips({ mode }: { mode: "map" | "calendar" }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3">
      <div className="flex rounded-full bg-muted p-0.5 text-sm font-medium">
        {(["map", "calendar"] as const).map((m) => (
          <span
            key={m}
            className={cn(
              "rounded-full px-3 py-1",
              m === mode
                ? "bg-card text-primary shadow-(--shadow-card)"
                : "text-muted-foreground"
            )}
          >
            {m}
          </span>
        ))}
      </div>
      <span className="flex size-9 items-center justify-center rounded-full bg-card text-sm font-semibold shadow-(--shadow-card)">
        y
      </span>
    </div>
  )
}

function goingLine(guests: Person[]): string {
  if (guests.length === 0) return "no one yet"
  if (guests.length === 1) return `${guests[0].name} going`
  return `${guests.length} going`
}

/** The host's own flare, as the home sheet lists it. */
function YourFlareRow({
  guests,
  started,
}: {
  guests: Person[]
  started: boolean
}) {
  const Category = MOCK_FLARE.icon
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card p-3 shadow-(--shadow-card)",
        started && "border-l-[3px] border-l-accent"
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Category className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{MOCK_FLARE.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {started ? MOCK_FLARE.liveFor : MOCK_FLARE.startsIn} ·{" "}
          {goingLine(guests)}
        </p>
      </div>
      {started ? (
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
          live
        </span>
      ) : (
        guests.length > 0 && <AvatarStack people={guests.slice(0, 3)} />
      )}
    </div>
  )
}

// --- map ------------------------------------------------------------------

const FRIEND_PINS: { icon: Icon; top: string; left: string; open: boolean }[] =
  [
    { icon: ForkKnifeIcon, top: "22%", left: "18%", open: true },
    { icon: BarbellIcon, top: "36%", left: "72%", open: false },
    { icon: PaletteIcon, top: "58%", left: "30%", open: false },
  ]

export function MapScreen({
  guests,
  started,
  navH,
}: {
  guests: Person[]
  started: boolean
  navH: number
}) {
  const Category = MOCK_FLARE.icon
  return (
    <div className="absolute inset-0">
      {/* A flat stand-in for the map: streets in border tone over muted. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundColor: "var(--muted)",
          backgroundImage: [
            "linear-gradient(115deg, transparent 47%, color-mix(in oklch, var(--card) 80%, transparent) 47% 50%, transparent 50%)",
            "linear-gradient(20deg, transparent 62%, color-mix(in oklch, var(--card) 80%, transparent) 62% 64%, transparent 64%)",
            "repeating-linear-gradient(0deg, transparent 0 58px, color-mix(in oklch, var(--border) 70%, transparent) 58px 60px)",
            "repeating-linear-gradient(90deg, transparent 0 74px, color-mix(in oklch, var(--border) 70%, transparent) 74px 76px)",
          ].join(","),
        }}
      />
      <div
        aria-hidden
        className="absolute top-[12%] right-[-10%] h-40 w-56 rounded-full bg-flare-open/25"
      />
      {FRIEND_PINS.map((p, i) => (
        <span
          key={i}
          className={cn(
            "absolute flex size-9 -translate-1/2 items-center justify-center rounded-full shadow-(--shadow-card)",
            p.open
              ? "bg-flare-open text-flare-open-ink"
              : "bg-flare-invite text-flare-invite-ink"
          )}
          style={{ top: p.top, left: p.left }}
        >
          <p.icon className="size-4" />
        </span>
      ))}
      {/* Your flare. Peach ring = live (#315). */}
      <span
        className={cn(
          "absolute top-[46%] left-[56%] flex size-11 -translate-1/2 items-center justify-center rounded-full bg-flare-invite text-flare-invite-ink shadow-(--shadow-card)",
          started && "ring-4 ring-primary"
        )}
      >
        <Category className="size-5" />
      </span>

      <div className="relative">
        <ModeChips mode="map" />
      </div>

      <div
        className="absolute inset-x-0 rounded-t-3xl bg-background px-4 pt-2 pb-3 shadow-(--shadow-sheet)"
        style={{ bottom: navH }}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          you&apos;re hosting
        </p>
        <YourFlareRow guests={guests} started={started} />
      </div>
    </div>
  )
}

// --- calendar -------------------------------------------------------------

const WEEK = [
  ["mon", 5],
  ["tue", 6],
  ["wed", 7],
  ["thu", 8],
  ["fri", 9],
  ["sat", 10],
  ["sun", 11],
] as const

export function CalendarScreen({ guests }: { guests: Person[] }) {
  return (
    <div className="absolute inset-0 bg-background">
      <ModeChips mode="calendar" />
      <div className="mt-4 flex justify-between px-4">
        {WEEK.map(([d, n], i) => (
          <div
            key={d}
            className={cn(
              "flex w-10 flex-col items-center rounded-lg py-1.5 text-xs",
              i === 6
                ? "bg-card font-semibold text-primary shadow-(--shadow-card)"
                : "text-muted-foreground"
            )}
          >
            <span>{d}</span>
            <span className="text-sm">{n}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2 px-4">
        <p className="text-xs font-medium text-muted-foreground">today</p>
        <YourFlareRow guests={guests} started={false} />
        <Row
          icon={ForkKnifeIcon}
          title="pizza at lea's"
          meta="20:30 · by lea"
        />
        <p className="pt-4 text-xs font-medium text-muted-foreground">
          tomorrow
        </p>
        <Row icon={BarbellIcon} title="bouldering" meta="18:00 · by jonas" />
        <Row icon={PaletteIcon} title="zine night" meta="19:30 · by sam" />
      </div>
    </div>
  )
}

function Row({
  icon: I,
  title,
  meta,
}: {
  icon: Icon
  title: string
  meta: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-(--shadow-card)">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <I className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  )
}

// --- event detail sheet ---------------------------------------------------

/**
 * Mirrors EventDetailSheet's frame: today it is fixed bottom-0 with z-50 and
 * a full-screen scrim, so it covers the nav (z-40) and the bell. "above"
 * sits it on top of the nav instead, the way NotificationsSheet does.
 */
export function DetailSheet({
  guests,
  sheetNav,
  navH,
  reg,
}: {
  guests: Person[]
  sheetNav: SheetNav
  navH: number
  reg: Reg
}) {
  const Category = MOCK_FLARE.icon
  const under = sheetNav === "under"
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 bg-foreground/30",
          under ? "z-30" : "z-10"
        )}
        style={{ bottom: under ? 0 : navH }}
      />
      <div
        className={cn(
          "absolute inset-x-0 rounded-t-3xl bg-background px-4 pb-6 shadow-(--shadow-sheet)",
          under ? "z-30" : "z-10"
        )}
        style={{ bottom: under ? 0 : navH }}
      >
        <div className="mx-auto mt-3 mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Category className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {MOCK_FLARE.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              you&apos;re hosting · {MOCK_FLARE.startsIn}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <ClockIcon className="size-4 text-muted-foreground" />
            today 19:00 · until 22:00
          </p>
          <p className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-muted-foreground" />
            {MOCK_FLARE.place} · neukölln
          </p>
        </div>
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="text-base font-semibold">going</p>
          <div className="mt-2 flex items-center gap-3">
            {guests.map((g) => (
              <div key={g.id} className="flex flex-col items-center gap-1">
                <PersonAvatar person={g} size="md" />
                <span className="text-xs">{g.name}</span>
              </div>
            ))}
            {/* The next free slot: where an "under" moment lands. */}
            <div className="flex flex-col items-center gap-1">
              <span className="relative flex">
                <span
                  ref={reg("slotRipple")}
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-full border-2 border-primary opacity-0"
                />
                <span
                  ref={reg("slot")}
                  className="size-10 rounded-full border-2 border-dashed border-border"
                />
              </span>
              <span className="text-xs text-muted-foreground">
                {guests.length === 0 ? "no one yet" : " "}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            arrival times show here once people join.
          </p>
        </div>
        <button
          type="button"
          className="mt-5 h-11 w-full rounded-full bg-muted text-sm font-medium"
        >
          share flare
        </button>
      </div>
    </>
  )
}
