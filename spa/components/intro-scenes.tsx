"use client"

// #377: the intro slides' illustrations, drawn in code so they share the
// app's own language: a night map of Berlin in the intro's dusk ink, friends
// as avatars in the pin colours (teal open to all, plum invite only) and the
// flare as the peach flare button with its flame. Each scene is a short story
// that teaches its slide and loops:
//
// - what: a flare lights on the map, routes draw out to three friends with
//   their ETAs, they walk over and gather under the pin.
// - why: an apartment block at night. Friends in separate windows, a group
//   chat of "we should" bubbles that rise and fade, and nobody meets. It ends
//   on one phone turning peach: the flare to come.
// - how: a finger presses the flare button, the fuse runs round it, the
//   signal rings out, friends light up and three of them join.
//
// Motion is CSS keyframes only (predetermined, so it runs off the main
// thread). Every scene loops on one clock, `LOOP`, and restarts from its
// first frame each time its slide comes on screen (`intro-slides.tsx` remounts
// it); off screen it holds still. Each element's resting style is the
// finished picture, so under prefers-reduced-motion the scene is a still that
// still explains the slide.

import type { CSSProperties, ReactNode } from "react"
import { CheckIcon, FlameIcon, WineIcon } from "@/components/icons"
import type { Kind } from "@/components/intro-slides"

const W = 390
const H = 360

/** One loop of every scene, in seconds. */
const LOOP = 9

// ---- palette -------------------------------------------------------------------

const INK = "oklch(0.21 0.05 295)"
const STREET = "oklch(0.265 0.05 295)"
const LANE = "oklch(0.235 0.05 295)"
const TOWER = "oklch(0.34 0.05 295)"
const RIVER = "oklch(0.31 0.08 278)"
const PARK = "oklch(0.3 0.06 185)"
const TREE = "oklch(0.37 0.07 185)"
const FACADE = "oklch(0.27 0.05 295)"
const FACADE_FAR = "oklch(0.24 0.045 295)"
const WINDOW_DARK = "oklch(0.23 0.045 295)"
const WINDOW_LIT = "oklch(0.48 0.08 78)"
const WINDOW_HOME = "oklch(0.76 0.11 80)"
const PAPER = "oklch(0.97 0.01 80)"
const GLASS = "oklch(1 0 0 / 0.12)"
const GLASS_EDGE = "oklch(1 0 0 / 0.2)"
const PEACH = "var(--accent)"
const PEACH_INK = "var(--accent-foreground)"

/** The pin colours (`--flare-open` / `--flare-invite`, light values: the
 * intro is always on ink). */
const TONES = {
  open: { fill: "oklch(0.87 0.07 185)", ink: "oklch(0.36 0.09 185)" },
  invite: { fill: "oklch(0.87 0.07 315)", ink: "oklch(0.36 0.09 315)" },
}
type Tone = keyof typeof TONES

// ---- motion helpers ------------------------------------------------------------

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)"

type Frame = [percent: number, css: string]

function keyframes(name: string, frames: Frame[]): string {
  const body = frames
    .map(([p, css]) => `${Math.round(p * 100) / 100}% { ${css} }`)
    .join(" ")
  return `@keyframes ${name} { ${body} }`
}

/** A keyframe's easing into the next one. */
const easeNext = (timing: string) => `animation-timing-function: ${timing};`

/** Runs `name` on the scene's clock. Easing between frames is set per frame. */
const onLoop = (name: string, delay = 0): CSSProperties => ({
  animation: `${name} ${LOOP}s linear ${delay}s infinite both`,
})

const css: string[] = []

/** Appears with a small rise at `at`, holds, and leaves at `out` (or stays to
 * the end of the loop when `out` is 100). */
function riseIn(name: string, at: number, out = 90): string {
  const hidden = "opacity: 0; transform: translateY(6px);"
  const shown = "opacity: 1; transform: none;"
  if (out >= 100)
    return keyframes(name, [
      [0, hidden],
      [at, hidden + easeNext(EASE_OUT)],
      [at + 6, shown],
      [100, shown],
    ])
  return keyframes(name, [
    [0, hidden],
    [at, hidden + easeNext(EASE_OUT)],
    [at + 6, shown],
    [out, shown + easeNext(EASE_OUT)],
    [out + 6, "opacity: 0; transform: none;"],
    [100, hidden],
  ])
}

// ---- shared pieces -------------------------------------------------------------

function Avatar({ letter, tone }: { letter: string; tone: Tone }) {
  const t = TONES[tone]
  return (
    <g>
      <circle r={16.5} fill={INK} />
      <circle r={14} fill={t.fill} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
        fill={t.ink}
      >
        {letter}
      </text>
    </g>
  )
}

const chipWidth = (label: string, icon: boolean) =>
  Math.round(label.length * 6.6 + 22 + (icon ? 18 : 0))

/** A pill centred on (0, 0): paper for what people say, glass for meta. A
 * `tail` (x offset) makes it a speech bubble. */
function Chip({
  label,
  paper,
  icon,
  tail,
}: {
  label: string
  paper?: boolean
  icon?: ReactNode
  tail?: number
}) {
  const w = chipWidth(label, !!icon)
  return (
    <g>
      {tail !== undefined && (
        <path
          d={`M${tail - 5} 10 L${tail} 17 L${tail + 5} 10 Z`}
          fill={PAPER}
        />
      )}
      <rect
        x={-w / 2}
        y={-12}
        width={w}
        height={24}
        rx={12}
        fill={paper ? PAPER : GLASS}
        stroke={paper ? "none" : GLASS_EDGE}
      />
      {icon && <g transform={`translate(${-w / 2 + 10} -7)`}>{icon}</g>}
      <text
        x={icon ? 9 : 0}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
        fill={paper ? INK : PAPER}
      >
        {label}
      </text>
    </g>
  )
}

function FlareMark({ r, lit = true }: { r: number; lit?: boolean }) {
  const size = Math.round(r * 1.1)
  return (
    <g>
      <circle r={r + 3} fill={INK} />
      <circle r={r} fill={PEACH} />
      <FlameIcon
        size={size}
        x={-size / 2}
        y={-size / 2}
        weight={lit ? "fill" : "regular"}
        color={PEACH_INK}
      />
    </g>
  )
}

/** How far past the viewBox the backgrounds reach. The svg overflows into
 * whatever room its slide has, and the vignette fades it out at the edges, so
 * a scene never shows a frame on a short phone or a tall one. */
const BLEED = 320

const span = (start: number, step: number) =>
  Array.from(
    { length: Math.ceil((W + 2 * BLEED) / step) + 1 },
    (_, i) => start - Math.ceil(BLEED / step) * step + i * step
  )

const AVENUES = span(40, 80)
const STREETS = span(60, 70)

/** Berlin at night, as a map: a street grid crossed by one diagonal, the
 * Spree with its bridges, a park and the TV tower. */
function MapBase() {
  const lo = -BLEED
  const hi = W + BLEED
  return (
    <g>
      <rect x={lo} y={lo} width={hi - lo} height={hi - lo} fill={INK} />
      {AVENUES.map((x) => (
        <line
          key={`l${x}`}
          x1={x + 40}
          y1={lo}
          x2={x + 40}
          y2={hi}
          stroke={LANE}
          strokeWidth={3}
        />
      ))}
      {STREETS.map((y) => (
        <line
          key={`l${y}`}
          x1={lo}
          y1={y + 35}
          x2={hi}
          y2={y + 35}
          stroke={LANE}
          strokeWidth={3}
        />
      ))}
      <path
        d={`M${lo} 262 L-20 262 C 60 236, 110 304, 196 290 S 326 238, 410 268 L${hi} 268`}
        fill="none"
        stroke={RIVER}
        strokeWidth={22}
        strokeLinecap="round"
      />
      {AVENUES.map((x) => (
        <line
          key={`a${x}`}
          x1={x}
          y1={lo}
          x2={x}
          y2={hi}
          stroke={STREET}
          strokeWidth={8}
        />
      ))}
      {STREETS.map((y) => (
        <line
          key={`s${y}`}
          x1={lo}
          y1={y}
          x2={hi}
          y2={y}
          stroke={STREET}
          strokeWidth={8}
        />
      ))}
      <line
        x1={-200}
        y1={300}
        x2={300}
        y2={-200}
        stroke={STREET}
        strokeWidth={8}
      />
      <rect x={290} y={140} width={60} height={50} rx={10} fill={PARK} />
      <circle cx={306} cy={157} r={7} fill={TREE} />
      <circle cx={329} cy={170} r={9} fill={TREE} />
      <circle cx={310} cy={177} r={5} fill={TREE} />
      <g transform="translate(80 170)" fill={TOWER}>
        <rect x={-2} y={-40} width={4} height={62} rx={2} />
        <rect x={-0.75} y={-54} width={1.5} height={16} />
        <circle cy={-22} r={8} />
      </g>
    </g>
  )
}

// ---- what: a flare on the map, friends gather ------------------------------------

const PIN = { x: 200, y: 160 }

type Walker = {
  id: string
  letter: string
  tone: Tone
  eta: string
  points: [number, number][]
  /** When the walk starts and ends, in % of the loop. */
  t0: number
  t1: number
}

const WALKERS: Walker[] = [
  {
    id: "a",
    letter: "m",
    tone: "open",
    eta: "6 min",
    points: [
      [120, 60],
      [120, 200],
      [176, 200],
    ],
    t0: 30,
    t1: 66,
  },
  {
    id: "b",
    letter: "j",
    tone: "invite",
    eta: "2 min",
    points: [
      [280, 270],
      [280, 200],
      [224, 200],
    ],
    t0: 30,
    t1: 53,
  },
  {
    id: "c",
    letter: "a",
    tone: "open",
    eta: "4 min",
    points: [
      [200, 340],
      [200, 200],
    ],
    t0: 34,
    t1: 60,
  },
]

const routeD = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")

for (const w of WALKERS) {
  // The route draws out from the friend, then is used up behind them.
  css.push(
    keyframes(`s1-route-${w.id}`, [
      [0, "stroke-dashoffset: 1;"],
      [12, "stroke-dashoffset: 1;" + easeNext(EASE_IN_OUT)],
      [24, "stroke-dashoffset: 0;"],
      [w.t0, "stroke-dashoffset: 0;" + easeNext("linear")],
      [w.t1, "stroke-dashoffset: -1;"],
      [100, "stroke-dashoffset: -1;"],
    ])
  )

  // The walk: constant speed along the streets, as people walk.
  const [x0, y0] = w.points[0]
  const lengths = w.points
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - w.points[i][0], y - w.points[i][1]))
  const total = lengths.reduce((a, b) => a + b, 0)
  const at = (x: number, y: number) =>
    `transform: translate(${x - x0}px, ${y - y0}px);`
  const frames: Frame[] = [
    [0, at(x0, y0)],
    [w.t0, at(x0, y0)],
  ]
  let run = 0
  w.points.slice(1).forEach(([x, y], i) => {
    run += lengths[i]
    frames.push([w.t0 + ((w.t1 - w.t0) * run) / total, at(x, y)])
  })
  frames.push([100, at(...w.points[w.points.length - 1])])
  css.push(keyframes(`s1-walk-${w.id}`, frames))

  // The ETA rides along and goes once they're there.
  css.push(riseIn(`s1-eta-${w.id}`, 14, w.t1 - 8))
}

css.push(
  keyframes("s1-loop", [
    [0, "opacity: 0;"],
    [3, "opacity: 1;"],
    [92, "opacity: 1;"],
    [98, "opacity: 0;"],
    [100, "opacity: 0;"],
  ]),
  keyframes("s1-pop", [
    [0, "opacity: 0; transform: scale(0.6);"],
    [4, "opacity: 0; transform: scale(0.6);" + easeNext(EASE_OUT)],
    [12, "opacity: 1; transform: none;"],
    [100, "opacity: 1; transform: none;"],
  ]),
  keyframes("s1-pulse", [
    [0, `opacity: 0.4; transform: scale(1); ${easeNext(EASE_OUT)}`],
    [100, "opacity: 0; transform: scale(2.6);"],
  ]),
  riseIn("s1-label", 10, 100),
  riseIn("s1-going", 70, 100)
)

function WhatScene() {
  return (
    <>
      <MapBase />
      <g style={onLoop("s1-loop")}>
        {WALKERS.map((w) => (
          <path
            key={w.id}
            d={routeD(w.points)}
            pathLength={1}
            fill="none"
            stroke={TONES[w.tone].fill}
            strokeOpacity={0.85}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            style={onLoop(`s1-route-${w.id}`)}
          />
        ))}

        <g transform={`translate(${PIN.x} ${PIN.y})`}>
          <g className="intro-box" style={onLoop("s1-pop")}>
            {[0, 1.2].map((delay) => (
              <circle
                key={delay}
                r={22}
                fill={PEACH}
                className="intro-box"
                style={{
                  animation: `s1-pulse 2.4s linear ${delay}s infinite both`,
                }}
              />
            ))}
            <FlareMark r={22} />
          </g>
        </g>

        <g transform={`translate(${PIN.x} ${PIN.y - 44})`}>
          <g style={onLoop("s1-label")}>
            <Chip label="ping-pong at 6pm" paper />
          </g>
        </g>

        {WALKERS.map((w) => (
          <g
            key={w.id}
            transform={`translate(${w.points[0][0]} ${w.points[0][1]})`}
          >
            <g style={onLoop(`s1-walk-${w.id}`)}>
              <Avatar letter={w.letter} tone={w.tone} />
              <g transform="translate(0 -30)">
                <g style={onLoop(`s1-eta-${w.id}`)}>
                  <Chip label={w.eta} />
                </g>
              </g>
            </g>
          </g>
        ))}

        <g transform={`translate(${PIN.x} ${PIN.y + 80})`}>
          <g style={{ ...onLoop("s1-going"), opacity: 0 }}>
            <Chip label="3 going" />
          </g>
        </g>
      </g>
    </>
  )
}

// ---- why: everyone in their own window ---------------------------------------------

const COLS = [103, 170, 237]
const ROWS = [48, 112, 176, 240, 304]
const WIN_W = 50
const WIN_H = 46

type Tenant = { col: number; row: number; letter: string; tone: Tone }

const TENANTS: Record<string, Tenant> = {
  a: { col: 0, row: 1, letter: "m", tone: "open" },
  b: { col: 2, row: 0, letter: "j", tone: "invite" },
  c: { col: 1, row: 2, letter: "a", tone: "open" },
  d: { col: 2, row: 3, letter: "l", tone: "invite" },
}

/** Lit windows with nobody we know in them. */
const LIT = new Set(["1-0", "0-3", "1-4", "0-0"])

const windowCentre = ({ col, row }: Pick<Tenant, "col" | "row">) => ({
  x: COLS[col] + WIN_W / 2,
  y: ROWS[row] + WIN_H / 2,
})

type Line = {
  who: keyof typeof TENANTS
  text: string
  at: number
  still?: boolean
}

/** The group chat. `still` lines show in the reduced-motion picture. */
const CHAT: Line[] = [
  { who: "a", text: "we should hang out!", at: 4, still: true },
  { who: "b", text: "yes!! soon", at: 14 },
  { who: "c", text: "this week?", at: 24, still: true },
  { who: "d", text: "busy, next week?", at: 34 },
  { who: "a", text: "let's find a day", at: 46 },
  { who: "b", text: "sounds good!", at: 58 },
]

CHAT.forEach(({ at }, i) => {
  const below = "opacity: 0; transform: translateY(8px) scale(0.96);"
  const gone = "opacity: 0; transform: translateY(-14px);"
  css.push(
    keyframes(`s2-say-${i}`, [
      [0, below],
      [at, below + easeNext(EASE_OUT)],
      [at + 3, "opacity: 1; transform: none;" + easeNext("linear")],
      [
        at + 20,
        "opacity: 1; transform: translateY(-8px);" + easeNext(EASE_OUT),
      ],
      [at + 24, gone],
      [100, gone],
    ])
  )
})

css.push(
  keyframes("s2-flow", [
    [0, "stroke-dashoffset: 0;"],
    [100, "stroke-dashoffset: -16;"],
  ]),
  keyframes("s2-spark", [
    [0, "opacity: 0; transform: scale(0.6);"],
    [80, "opacity: 0; transform: scale(0.6);" + easeNext(EASE_OUT)],
    [84, "opacity: 1; transform: none;" + easeNext(EASE_IN_OUT)],
    [88, "opacity: 1; transform: scale(1.25);" + easeNext(EASE_OUT)],
    [97, "opacity: 0; transform: translateY(-70px) scale(0.7);"],
    [100, "opacity: 0; transform: scale(0.6);"],
  ])
)

/** A neighbouring block: a few dim windows, deterministic. */
function FarBlock({ x, y, w }: { x: number; y: number; w: number }) {
  const cols = Math.floor((w - 12) / 20)
  const rows = Math.floor((H + BLEED - y) / 28)
  return (
    <g>
      <rect x={x} y={y} width={w} height={H + BLEED - y} fill={FACADE_FAR} />
      {Array.from({ length: rows * cols }, (_, i) => {
        const c = i % cols
        const r = Math.floor(i / cols)
        const lit = (c * 7 + r * 3) % 5 === 0
        return (
          <rect
            key={i}
            x={x + 10 + c * 20}
            y={y + 14 + r * 28}
            width={11}
            height={15}
            rx={2}
            fill={lit ? WINDOW_LIT : WINDOW_DARK}
            opacity={lit ? 0.6 : 1}
          />
        )
      })}
    </g>
  )
}

function WhyScene() {
  const tenants = Object.entries(TENANTS)
  const links: [string, string][] = [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["a", "c"],
  ]
  return (
    <>
      <rect
        x={-BLEED}
        y={-BLEED}
        width={W + 2 * BLEED}
        height={H + 2 * BLEED}
        fill={INK}
      />
      <g fill="oklch(0.9 0.03 80)">
        <circle cx={346} cy={40} r={13} />
        <circle cx={352} cy={35} r={12} fill={INK} />
      </g>
      <FarBlock x={-120} y={150} w={96} />
      <FarBlock x={-10} y={110} w={82} />
      <FarBlock x={318} y={84} w={90} />
      <FarBlock x={420} y={140} w={96} />

      <rect x={85} y={30} width={220} height={H + BLEED} rx={6} fill={FACADE} />
      {ROWS.flatMap((y, row) =>
        COLS.map((x, col) => {
          const home = tenants.some(([, t]) => t.col === col && t.row === row)
          const lit = LIT.has(`${col}-${row}`)
          return (
            <rect
              key={`${col}-${row}`}
              x={x}
              y={y}
              width={WIN_W}
              height={WIN_H}
              rx={4}
              fill={home ? WINDOW_HOME : lit ? WINDOW_LIT : WINDOW_DARK}
            />
          )
        })
      )}

      {/* Connected: the lines are always busy, and never bring anyone over. */}
      {links.map(([from, to]) => {
        const a = windowCentre(TENANTS[from])
        const b = windowCentre(TENANTS[to])
        return (
          <line
            key={from + to}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="oklch(1 0 0 / 0.22)"
            strokeWidth={1.5}
            strokeDasharray="2 6"
            strokeLinecap="round"
            style={{ animation: "s2-flow 1.2s linear infinite" }}
          />
        )
      })}

      {tenants.map(([id, t]) => {
        const { x, y } = windowCentre(t)
        return (
          <g key={id}>
            <g transform={`translate(${x - 5} ${y + 4}) scale(0.78)`}>
              <Avatar letter={t.letter} tone={t.tone} />
            </g>
            <rect
              x={x + 10}
              y={y - 6}
              width={7}
              height={11}
              rx={1.5}
              fill={PAPER}
              stroke={INK}
              strokeWidth={1.5}
            />
            {id === "c" && (
              <g transform={`translate(${x + 13.5} ${y - 0.5})`}>
                <g
                  className="intro-box"
                  style={{ ...onLoop("s2-spark"), opacity: 0 }}
                >
                  <circle r={12} fill={PEACH} opacity={0.35} />
                  <circle r={5} fill={PEACH} />
                </g>
              </g>
            )}
          </g>
        )
      })}

      {CHAT.map((line, i) => {
        const { x, y } = windowCentre(TENANTS[line.who])
        const w = chipWidth(line.text, false)
        const cx = Math.min(Math.max(x, w / 2 + 8), W - w / 2 - 8)
        return (
          <g key={i} transform={`translate(${cx} ${y - 34})`}>
            <g
              className="intro-box"
              style={{ ...onLoop(`s2-say-${i}`), opacity: line.still ? 1 : 0 }}
            >
              <Chip label={line.text} paper tail={x - cx} />
            </g>
          </g>
        )
      })}
    </>
  )
}

// ---- how: light a flare ----------------------------------------------------------

const HUB = { x: 195, y: 175 }

type Friend = {
  letter: string
  tone: Tone
  x: number
  y: number
  joins?: number
}

const FRIENDS: Friend[] = [
  { letter: "m", tone: "open", x: 70, y: 95, joins: 48 },
  { letter: "j", tone: "invite", x: 320, y: 90, joins: 54 },
  { letter: "s", tone: "invite", x: 45, y: 215 },
  { letter: "k", tone: "open", x: 345, y: 215, joins: 60 },
  { letter: "a", tone: "open", x: 115, y: 305 },
  { letter: "l", tone: "invite", x: 280, y: 305 },
]

const dim = "opacity: 0.35; transform: scale(0.92);"
const on = "opacity: 1; transform: none;"

css.push(
  keyframes("s3-tap", [
    [0, "opacity: 0; transform: scale(1.15);"],
    [2, "opacity: 0; transform: scale(1.15);" + easeNext(EASE_OUT)],
    [7, "opacity: 0.8; transform: scale(0.68);" + easeNext(EASE_OUT)],
    [11, "opacity: 0; transform: scale(0.62);"],
    [100, "opacity: 0; transform: scale(0.62);"],
  ]),
  keyframes("s3-press", [
    [0, "transform: none;"],
    [7, "transform: none;" + easeNext(EASE_OUT)],
    [9.5, "transform: scale(0.92);" + easeNext(EASE_OUT)],
    [16, "transform: none;"],
    [100, "transform: none;"],
  ]),
  keyframes("s3-fuse", [
    [0, "stroke-dashoffset: 1; opacity: 1;"],
    [10, "stroke-dashoffset: 1; opacity: 1;" + easeNext(EASE_IN_OUT)],
    [24, "stroke-dashoffset: 0; opacity: 1;"],
    [90, "stroke-dashoffset: 0; opacity: 1;" + easeNext(EASE_OUT)],
    [97, "stroke-dashoffset: 0; opacity: 0;"],
    [100, "stroke-dashoffset: 1; opacity: 0;"],
  ]),
  keyframes("s3-lit", [
    [0, "opacity: 0;"],
    [20, "opacity: 0;" + easeNext(EASE_OUT)],
    [27, "opacity: 1;"],
    [90, "opacity: 1;" + easeNext(EASE_OUT)],
    [97, "opacity: 0;"],
    [100, "opacity: 0;"],
  ]),
  keyframes("s3-ring", [
    [0, "opacity: 0; transform: scale(1);"],
    [26, "opacity: 0; transform: scale(1);"],
    [27, "opacity: 0.7; transform: scale(1);" + easeNext(EASE_OUT)],
    [46, "opacity: 0; transform: scale(4.6);"],
    [100, "opacity: 0; transform: scale(4.6);"],
  ]),
  keyframes("s3-reach", [
    [0, dim],
    [33, dim + easeNext(EASE_OUT)],
    [38, on],
    [90, on + easeNext(EASE_OUT)],
    [97, dim],
    [100, dim],
  ]),
  riseIn("s3-title", 14),
  riseIn("s3-count", 64)
)

for (const f of FRIENDS) {
  if (f.joins === undefined) continue
  const hidden = "opacity: 0; transform: scale(0.6);"
  css.push(
    keyframes(`s3-join-${f.letter}`, [
      [0, hidden],
      [f.joins, hidden + easeNext(EASE_OUT)],
      [f.joins + 5, on],
      [90, on + easeNext(EASE_OUT)],
      [96, "opacity: 0; transform: none;"],
      [100, hidden],
    ])
  )
}

function HowScene() {
  return (
    <>
      <defs>
        <radialGradient id="intro-how-glow">
          <stop offset="0%" stopColor={PEACH} stopOpacity={0.45} />
          <stop offset="100%" stopColor={PEACH} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g opacity={0.45}>
        <MapBase />
      </g>

      <g transform={`translate(${HUB.x} ${HUB.y})`}>
        <circle r={95} fill="url(#intro-how-glow)" style={onLoop("s3-lit")} />
        {[0, 0.4, 0.8].map((delay) => (
          <circle
            key={delay}
            r={34}
            fill="none"
            stroke={PEACH}
            strokeWidth={2}
            className="intro-box"
            style={{ ...onLoop("s3-ring", delay), opacity: 0 }}
          />
        ))}
        <circle
          r={46}
          fill="none"
          stroke={PEACH}
          strokeWidth={3}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          transform="rotate(-90)"
          style={onLoop("s3-fuse")}
        />
        <g className="intro-box" style={onLoop("s3-press")}>
          <FlareMark r={34} lit={false} />
          <g style={onLoop("s3-lit")}>
            <FlareMark r={34} />
          </g>
        </g>
        <circle
          r={56}
          fill="none"
          stroke={PAPER}
          strokeWidth={2}
          className="intro-box"
          style={{ ...onLoop("s3-tap"), opacity: 0 }}
        />
      </g>

      <g transform={`translate(${HUB.x} ${HUB.y - 72})`}>
        <g style={onLoop("s3-title")}>
          <Chip
            label="drinks at 7pm"
            paper
            icon={<WineIcon size={14} weight="bold" color={INK} />}
          />
        </g>
      </g>

      {FRIENDS.map((f) => (
        <g key={f.letter} transform={`translate(${f.x} ${f.y})`}>
          <g className="intro-box" style={onLoop("s3-reach")}>
            <Avatar letter={f.letter} tone={f.tone} />
          </g>
          {f.joins !== undefined && (
            <g transform="translate(12 12)">
              <g className="intro-box" style={onLoop(`s3-join-${f.letter}`)}>
                <circle r={9} fill={PAPER} stroke={INK} strokeWidth={2} />
                <CheckIcon
                  size={11}
                  x={-5.5}
                  y={-5.5}
                  weight="bold"
                  color={INK}
                />
              </g>
            </g>
          )}
        </g>
      ))}

      <g transform={`translate(${HUB.x} ${HUB.y + 76})`}>
        <g style={onLoop("s3-count")}>
          <Chip label="3 joining" />
        </g>
      </g>
    </>
  )
}

// ---- the scene -----------------------------------------------------------------

const SCENES: Record<Kind, () => ReactNode> = {
  what: WhatScene,
  why: WhyScene,
  how: HowScene,
}

/** The top and bottom fade into the ink, so a scene has no frame however
 * tall its slide is. The sides are the screen's own edges. */
const VIGNETTE =
  "linear-gradient(to bottom, transparent, black 16%, black 78%, transparent)"

/** One slide's illustration. It plays only while `active`; mount it again to
 * start its story over. Decorative: the slide's copy says the same. */
export function IntroScene({ kind, active }: { kind: Kind; active: boolean }) {
  const Scene = SCENES[kind]
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      data-intro-scene={kind}
      data-active={active || undefined}
      className="mx-auto block h-full w-full max-w-lg"
      style={{
        overflow: "visible",
        maskImage: VIGNETTE,
        WebkitMaskImage: VIGNETTE,
      }}
      aria-hidden
      focusable="false"
    >
      <Scene />
    </svg>
  )
}

/** The scenes' keyframes, for `IntroStyles`. */
export const INTRO_SCENE_CSS = `
  .intro-box { transform-box: fill-box; transform-origin: center; }
  [data-intro-scene]:not([data-active]) * { animation-play-state: paused !important; }
  ${css.join("\n  ")}
  @media (prefers-reduced-motion: reduce) {
    [data-intro-scene] * { animation: none !important; }
  }
`
