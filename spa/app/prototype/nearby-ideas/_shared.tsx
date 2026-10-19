"use client"

// PROTOTYPE (#563), throwaway. The frame the four takes share: a faux map in
// today's static-map look, the projection from real coordinates to the frame,
// the person's dot, the idea pin, the top bar, the home's two CTAs and the
// prototype switcher. The takes themselves live in _take-*.tsx.

import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react"
import {
  CalendarBlankIcon,
  FlameIcon,
  ListIcon,
  MapTrifoldIcon,
  UserPlusIcon,
} from "@/components/icons"
import { IdeaIcon } from "@/components/idea-icon"
import { cn } from "@/lib/utils"
import { offsetMeters, type NearSpot } from "./_spots"

export const TAKES = [
  { key: "a", name: "a · at the spot" },
  { key: "b", name: "b · compass ring" },
  { key: "c", name: "c · spotlight" },
  { key: "d", name: "d · radar (wild)" },
] as const
export type TakeKey = (typeof TAKES)[number]["key"]

export type TakeProps = {
  /** Reduced motion: nothing travels; highlights swap in place. */
  still: boolean
  onLight: (spot: NearSpot) => void
}

/** Pixels per metre on the frame: 600 m is about 270 px. */
export const SCALE = 0.45
/** Where the person's dot sits, from the top of the frame. */
export const USER_TOP = "40%"

/** Frame position of a real coordinate, relative to the person's dot. */
export function pointPx(p: { lat: number; lng: number }) {
  const { east, north } = offsetMeters(p)
  return { x: east * SCALE, y: -north * SCALE }
}

/** Absolute position for something centred on a point `x`/`y` px from the dot. */
export function atPx(x: number, y: number): CSSProperties {
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(${USER_TOP} + ${y}px)`,
    transform: "translate(-50%, -50%)",
  }
}

export function at(p: { lat: number; lng: number }): CSSProperties {
  const { x, y } = pointPx(p)
  return atPx(x, y)
}

/** Today's static map: pale grid, a few streets, humboldthain's green. */
export function FauxMap({ children }: { children?: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="proto-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M28 0H0V28"
              fill="none"
              className="stroke-border"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#proto-grid)"
          opacity="0.5"
        />
      </svg>
      {/* The park sits roughly under the person: a soft green blob. */}
      <div
        aria-hidden="true"
        style={atPx(-10, 10)}
        className="absolute h-[200px] w-[300px] rounded-[45%] bg-[oklch(0.9_0.04_150)] opacity-60 dark:bg-[oklch(0.34_0.04_150)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[18%] h-2 -rotate-6 bg-card"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[66%] h-2 rotate-3 bg-card"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-[76%] w-2 rotate-6 bg-card"
      />
      {children}
    </div>
  )
}

/** The person's position: today's peach dot. */
export function UserDot({ pulse = false }: { pulse?: boolean }) {
  return (
    <span
      data-user-dot
      style={atPx(0, 0)}
      className="absolute z-10 flex size-4 items-center justify-center"
    >
      {pulse && (
        <span className="absolute size-4 rounded-full bg-primary/40 motion-safe:animate-ping" />
      )}
      <span className="size-3.5 rounded-full border-2 border-background bg-primary shadow-sm" />
    </span>
  )
}

/** An idea pin: today's peach dashed circle, with the spot's own icon. */
export function SpotPin({
  spot,
  size = "md",
  active = false,
  dim = false,
  style,
  onClick,
}: {
  spot: NearSpot
  size?: "sm" | "md" | "lg"
  active?: boolean
  dim?: boolean
  style?: CSSProperties
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${spot.title}, ${spot.place}`}
      style={style ?? at(spot)}
      className={cn(
        "absolute flex items-center justify-center rounded-full border-2 border-dashed bg-background/90 text-foreground transition-[width,height,opacity,border-color] duration-300",
        size === "sm" && "size-7",
        size === "md" && "size-9",
        size === "lg" && "size-12",
        active ? "z-20 border-primary bg-card shadow-md" : "border-primary/70",
        dim && "opacity-40"
      )}
    >
      <IdeaIcon
        idea={{ icon: spot.icon, category: "hangout" }}
        className={size === "lg" ? "size-5" : "size-4"}
      />
    </button>
  )
}

const SURFACE =
  "h-11 rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md"

/** Today's top bar: menu, now/soon, invite. */
export function TopBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 pt-3">
      <span className={cn(SURFACE, "flex w-11 items-center justify-center")}>
        <ListIcon className="size-4" />
      </span>
      <span className={cn(SURFACE, "flex items-center p-1 text-sm")}>
        <span className="flex h-full items-center gap-1.5 rounded-full bg-card px-3.5 font-semibold">
          <MapTrifoldIcon className="size-4" /> now
        </span>
        <span className="flex h-full items-center gap-1.5 px-3.5 font-medium text-muted-foreground">
          <CalendarBlankIcon className="size-4" /> soon
        </span>
      </span>
      <span
        className={cn(
          SURFACE,
          "flex items-center gap-1.5 px-3.5 text-sm font-medium"
        )}
      >
        <UserPlusIcon className="size-4" /> invite
      </span>
    </div>
  )
}

/** The home's slot above the bottom nav. */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ bottom: "var(--sponti-nav-h, 64px)" }}
      className="fixed inset-x-0 z-20 flex flex-col gap-2 px-3 pb-2"
    >
      {children}
    </div>
  )
}

/** Today's two flare CTAs (#562), unchanged in every take. */
export function HomeCtas() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { Icon: FlameIcon, title: "what are you up for right now?" },
        { Icon: CalendarBlankIcon, title: "got a plan for soon?" },
      ].map(({ Icon, title }) => (
        <div
          key={title}
          className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
            <Icon className="size-4" />
          </span>
          <p className="mt-2.5 text-sm font-semibold">{title}</p>
        </div>
      ))}
    </div>
  )
}

/** ?motion=reduce, or the device's own reduced-motion setting. */
export function useStill(param: string | null): boolean {
  const media = useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia("(prefers-reduced-motion: reduce)")
      q.addEventListener("change", cb)
      return () => q.removeEventListener("change", cb)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
  return param === "reduce" || media
}

export function PrototypeBar({
  take,
  still,
  onTake,
  onStill,
}: {
  take: TakeKey
  still: boolean
  onTake: (t: TakeKey) => void
  onStill: (s: boolean) => void
}) {
  return (
    <div className="fixed inset-x-0 top-16 z-40 mx-3 flex flex-wrap gap-1 rounded-xl border border-border bg-background/95 p-1.5 text-xs shadow-sm">
      {TAKES.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onTake(t.key)}
          className={cn(
            "rounded-lg px-2 py-1",
            t.key === take ? "bg-card font-semibold text-primary" : ""
          )}
        >
          {t.name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onStill(!still)}
        className={cn(
          "ml-auto rounded-lg px-2 py-1",
          still && "bg-card font-semibold text-primary"
        )}
      >
        reduced motion
      </button>
    </div>
  )
}
