"use client"

// PROTOTYPE (lighting takeover) — throwaway. A still mock of the home screen
// (a drawn map, other flares' pins, the top bar, the rail and the nav) with
// the composer's sheet open, plus the layer the moment plays in. Nothing here
// moves by itself: the page's runner drives every transform each frame.

import { forwardRef, type RefObject } from "react"
import {
  BellIcon,
  CalendarBlankIcon,
  FireIcon,
  HouseIcon,
  ListIcon,
  MapTrifoldIcon,
  UserPlusIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons"
import { FlarePin, type FlarePinEvent } from "@/components/map-flare-pin"
import { NavFlareButton } from "@/components/bottom-nav"
import { StrikeStrip } from "@/components/strike-strip"
import { jitter, type Point } from "./_engine"

// ---- the world ----------------------------------------------------------------

/** The drawn map, in map px (1 map px = 1 screen px at scale 1). */
export const WORLD = { w: 1600, h: 1950 }
/** Where the new flare is on the map. */
export const FLARE: Point = { x: 800, y: 1300 }

const MIN = 60_000

/** Other people's flares around it, so the map reads as the home map. */
export const OTHERS: { at: Point; event: FlarePinEvent }[] = [
  { at: { x: 640, y: 1120 }, type: "drinks", vis: "private", live: true },
  { at: { x: 930, y: 1060 }, type: "food", vis: "public", live: false },
  { at: { x: 1010, y: 1420 }, type: "culture", vis: "public", live: false },
  { at: { x: 590, y: 1480 }, type: "hangout", vis: "private", live: false },
  { at: { x: 760, y: 900 }, type: "party", vis: "public", live: true },
].map((p, i) => ({
  at: p.at,
  event: {
    id: `other-${i}`,
    type: p.type as FlarePinEvent["type"],
    visibility: p.vis as FlarePinEvent["visibility"],
    // Fixed clock times, so the server and client render match.
    startAt: new Date(p.live ? 0 : 4 * 3600 * 1000).toISOString(),
    endAt: new Date(p.live ? 8 * 3600 * 1000 : 6 * 3600 * 1000).toISOString(),
  },
}))
/** The map's clock for the other pins: inside the live ones' window. */
export const OTHERS_NOW = 2 * 3600 * 1000

export const LIT_ID = "lit-flare"
export const litEvent = (
  type: FlarePinEvent["type"],
  visibility: FlarePinEvent["visibility"],
  soon: boolean,
  now: number
): FlarePinEvent => ({
  id: LIT_ID,
  type,
  visibility,
  startAt: new Date(soon ? now + 15 * MIN : now - MIN).toISOString(),
  endAt: new Date(now + (soon ? 135 : 120) * MIN).toISOString(),
})

function MapArt() {
  // Streets: a loose grid with a few long avenues, a river and some parks.
  const cols = Array.from({ length: 15 }, (_, i) => 60 + i * 110)
  const rows = Array.from({ length: 18 }, (_, i) => 50 + i * 110)
  return (
    <svg
      aria-hidden
      width={WORLD.w}
      height={WORLD.h}
      viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}
      className="block"
    >
      <rect width={WORLD.w} height={WORLD.h} fill="var(--map-land)" />
      {/* Building footprints, so the map has texture when the camera is close. */}
      <g fill="var(--map-block)">
        {cols.flatMap((x, i) =>
          rows.flatMap((y, j) =>
            [0, 1, 2, 3].map((n) => {
              const seed = i * 131 + j * 17 + n
              return (
                <rect
                  key={`b${i}-${j}-${n}`}
                  x={x + 16 + (n % 2) * 40 + jitter(seed, 5) * 10}
                  y={y + 16 + Math.floor(n / 2) * 40 + jitter(seed, 6) * 10}
                  width={16 + jitter(seed, 7) * 16}
                  height={14 + jitter(seed, 8) * 18}
                  rx={2}
                />
              )
            })
          )
        )}
      </g>
      {[
        [180, 260, 260, 180],
        [980, 1160, 220, 150],
        [420, 1560, 300, 200],
        [1180, 540, 200, 260],
        [640, 700, 150, 120],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={18}
          fill="var(--map-park)"
        />
      ))}
      <path
        d="M-40 1720 C 300 1600 420 1380 700 1420 S 1100 1660 1640 1480 L1640 1600 C 1100 1780 900 1560 700 1540 S 300 1760 -40 1840 Z"
        fill="var(--map-water)"
      />
      <path
        d="M1100 -20 C 1000 300 1200 600 1060 900 S 1180 1200 1260 1300"
        stroke="var(--map-water)"
        strokeWidth={34}
        fill="none"
      />
      <g stroke="var(--map-road)" strokeLinecap="round" fill="none">
        {cols.map((x, i) => (
          <path
            key={`c${i}`}
            d={`M${x + jitter(i, 1) * 30} 0 L${x - 20 + jitter(i, 2) * 40} ${WORLD.h}`}
            strokeWidth={i % 4 === 1 ? 14 : 7}
          />
        ))}
        {rows.map((y, i) => (
          <path
            key={`r${i}`}
            d={`M0 ${y + jitter(i, 3) * 30} L${WORLD.w} ${y - 20 + jitter(i, 4) * 40}`}
            strokeWidth={i % 5 === 2 ? 14 : 7}
          />
        ))}
        <path d="M0 400 L1600 1500" strokeWidth={16} />
        <path d="M200 1950 L1300 0" strokeWidth={12} />
      </g>
    </svg>
  )
}

// ---- the still home screen ------------------------------------------------------

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
    <span
      className={`flex min-h-11 max-w-20 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium ${
        active ? "text-accent-ink" : "text-muted-foreground"
      }`}
    >
      <I className="h-5 w-5" weight={active ? "fill" : "regular"} />
      {label}
    </span>
  )
}

function Chrome() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-card shadow">
          <ListIcon className="size-5" />
        </span>
        <span className="flex h-10 items-center gap-1 rounded-full bg-card p-1 text-xs shadow">
          <span className="flex h-8 items-center gap-1 rounded-full bg-muted px-3 font-medium text-primary">
            <MapTrifoldIcon className="size-4" /> now
          </span>
          <span className="flex h-8 items-center gap-1 px-3 text-muted-foreground">
            <CalendarBlankIcon className="size-4" /> soon
          </span>
        </span>
        <span className="ml-auto flex h-10 items-center gap-1 rounded-full bg-card px-3 text-xs shadow">
          <UserPlusIcon className="size-4" /> invite
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0">
        <div className="rounded-t-3xl bg-background px-4 pt-3 pb-3 shadow-(--shadow-sheet)">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          <p className="text-base font-semibold">flares near you</p>
          <p className="text-xs text-muted-foreground">
            5 around you right now
          </p>
        </div>
        <nav className="flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <NavItem icon={HouseIcon} label="home" active />
          <NavItem icon={BellIcon} label="feed" />
          <NavFlareButton onClick={() => {}} />
          <NavItem icon={UsersIcon} label="circles" />
          <NavItem icon={FireIcon} label="my flares" />
        </nav>
      </div>
    </>
  )
}

/** The composer's sheet, cut down to what matters here: what and the strip. */
const ComposerSheet = forwardRef<
  HTMLDivElement,
  { title: string; when: string; busy: boolean; onLight: () => void }
>(function ComposerSheet({ title, when, busy, onLight }, ref) {
  return (
    <div
      ref={ref}
      className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet)"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
      <p className="text-center text-base font-semibold">light a flare</p>
      <div className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-sm">
        {title}
      </div>
      <div className="mt-2 flex gap-2 text-xs">
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-accent-ink">
          {when}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">holmes place</span>
        <span className="rounded-full bg-muted px-2.5 py-1">friends</span>
      </div>
      <div className="mt-6">
        <StrikeStrip
          label={busy ? "lighting…" : "swipe to light"}
          busy={busy}
          onLight={onLight}
        />
      </div>
    </div>
  )
})

// ---- the scene ------------------------------------------------------------------

/** Every element the runner moves. */
export type SceneEls = {
  world: HTMLDivElement | null
  others: (HTMLDivElement | null)[]
  mapPin: HTMLDivElement | null
  sheet: HTMLDivElement | null
  moment: HTMLDivElement | null
  scrim: HTMLDivElement | null
  night: HTMLDivElement | null
  tint: HTMLDivElement | null
  canvas: HTMLCanvasElement | null
  hero: HTMLDivElement | null
  heroScale: HTMLDivElement | null
  cover: HTMLDivElement | null
  text: HTMLDivElement | null
}

export const emptyEls = (): SceneEls => ({
  world: null,
  others: [],
  mapPin: null,
  sheet: null,
  moment: null,
  scrim: null,
  night: null,
  tint: null,
  canvas: null,
  hero: null,
  heroScale: null,
  cover: null,
  text: null,
})

// The veil is the page's own background: navy night in dark mode, pale
// pink-cream in light mode (lighter, at most VEIL_MAX[light]).
const VEIL = "var(--background)"

export function Scene({
  els,
  lit,
  Icon,
  title,
  when,
  chipWhen,
  busy,
  onLight,
  now,
}: {
  els: RefObject<SceneEls>
  /** The page's clock for the new flare's pin label, in ms. */
  now: number
  lit: FlarePinEvent
  Icon: Icon
  title: string
  /** "live now" or "in 15 min". */
  when: string
  /** The composer's when chip. */
  chipWhen: string
  busy: boolean
  onLight: () => void
}) {
  const set =
    <K extends keyof SceneEls>(key: K) =>
    (el: SceneEls[K]) => {
      els.current[key] = el
    }
  return (
    <div
      data-testid="takeover-stage"
      className="absolute inset-0 overflow-hidden bg-background text-foreground [--map-block:color-mix(in_oklch,var(--foreground)_5%,var(--background))] [--map-land:var(--background)] [--map-park:color-mix(in_srgb,oklch(0.8_0.1_145)_35%,var(--background))] [--map-road:var(--card)] [--map-water:color-mix(in_srgb,var(--flare-open)_70%,var(--background))]"
    >
      {/* The map: one transform, set by the runner every frame. */}
      <div
        ref={set("world")}
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{ width: WORLD.w, height: WORLD.h }}
      >
        <MapArt />
      </div>

      {/* Pins sit in screen space, so they keep their size while the map zooms. */}
      <div className="absolute inset-0">
        {OTHERS.map((o, i) => (
          <div
            key={o.event.id}
            ref={(el) => {
              els.current.others[i] = el
            }}
            className="absolute top-0 left-0"
          >
            <div className="-translate-x-1/2 -translate-y-5">
              <FlarePin
                event={o.event}
                own={false}
                joined={false}
                now={OTHERS_NOW}
              />
            </div>
          </div>
        ))}
        {/* The new flare's real pin: hidden until the moment hands over. */}
        <div
          ref={set("mapPin")}
          data-testid="map-pin"
          className="absolute top-0 left-0"
          style={{ visibility: "hidden" }}
        >
          <div className="-translate-x-1/2 -translate-y-5">
            <FlarePin event={lit} own joined={false} now={now} />
          </div>
        </div>
      </div>

      <Chrome />

      <ComposerSheet
        ref={set("sheet")}
        title={title}
        when={chipWhen}
        busy={busy}
        onLight={onLight}
      />

      {/* ---- the moment's layer, above everything, nav included ---- */}
      <div
        ref={set("moment")}
        data-flare-moment
        className="pointer-events-none absolute inset-0"
      >
        <div
          ref={set("scrim")}
          aria-hidden
          className="absolute top-0 left-0 rounded-full opacity-0"
          style={{
            width: 2400,
            height: 2400,
            marginLeft: -1200,
            marginTop: -1200,
            // A spotlight on the flare's spot: the map shows through around it.
            background: `radial-gradient(circle, color-mix(in oklch, ${VEIL} 30%, transparent) 0px, color-mix(in oklch, ${VEIL} 45%, transparent) 70px, color-mix(in oklch, ${VEIL} 85%, transparent) 140px, ${VEIL} 250px)`,
          }}
        />
        <div
          ref={set("night")}
          aria-hidden
          className="absolute inset-0 opacity-0"
          style={{ background: VEIL }}
        />
        <div
          ref={set("tint")}
          aria-hidden
          className="absolute inset-0 opacity-0"
          style={{
            background:
              "radial-gradient(120% 70% at 50% 22%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 70%)",
          }}
        />
        <canvas
          ref={set("canvas")}
          aria-hidden
          className="absolute inset-0 h-full w-full"
        />
        <div
          ref={set("hero")}
          data-testid="hero-pin"
          className="absolute top-0 left-0 opacity-0"
        >
          <div className="-translate-x-1/2 -translate-y-5">
            <div ref={set("heroScale")} className="relative origin-[50%_20px]">
              <FlarePin event={lit} own joined={false} now={now} />
              {/* The flare before it catches: the same circle, unlit. */}
              <div
                ref={set("cover")}
                className="absolute -top-0.5 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border-4 border-card bg-card text-muted-foreground shadow-lg"
              >
                <Icon aria-hidden className="size-5" />
              </div>
            </div>
          </div>
        </div>
        {/* What was lit and when, in the app's own type: no "lit", no big word. */}
        <div
          ref={set("text")}
          aria-live="polite"
          className="absolute top-0 left-0 flex w-max max-w-72 flex-col items-center text-center opacity-0"
        >
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="text-sm font-medium text-accent-ink">{when}</p>
        </div>
      </div>
    </div>
  )
}
