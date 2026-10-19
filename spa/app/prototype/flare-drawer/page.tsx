"use client"

// PROTOTYPE (#615) — throwaway route, NOT production.
// Question: can one drawer over the home map replace both the map sheet and
// the /event/[id] page? Drag it between peek, half and full; the map keeps the
// flare's pin centred in whatever map is left visible, moves with one finger,
// and never jumps back to the viewer.
//
// ?variant=A|B   A: a plain sheet that covers the map at full.
//                B (wildcard): peek is a floating card, and full keeps a strip
//                of live map on top so the place never disappears.
// ?viewer=invited|joined|host, ?from=map|calendar|link (what "close" does),
// ?snap=0|1|2 opens at peek, half or full,
// ?bar=0 hides the prototype bar (for screenshots).
// Once a direction is picked: record it on #615, delete this folder.

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import {
  CalendarBlankIcon,
  FlameIcon,
  GpsFixIcon,
  HouseIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons"
import type { FlareViewer } from "@/lib/flare-detail"
import { cn } from "@/lib/utils"
import { FlareDrawer, type Snap, type Variant } from "./_drawer"
import { PrototypeMap } from "./_map"
import { FLARES, ORIGINS, VIEWERS, type MockFlare, type Origin } from "./_mock"

const NAV_H = 68
const PEEK_H = 156
/** B keeps this much live map above the drawer at full. */
const MAP_STRIP_H = 150

export default function FlareDrawerPrototypePage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        prototypes are only available in development.
      </p>
    )
  }
  return (
    <Suspense>
      <Prototype />
    </Suspense>
  )
}

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function useViewportHeight() {
  const [h, setH] = useState<number | null>(null)
  useEffect(() => {
    const read = () => setH(window.visualViewport?.height ?? window.innerHeight)
    read()
    window.addEventListener("resize", read)
    return () => window.removeEventListener("resize", read)
  }, [])
  return h
}

/** Which flare each origin opens on its own. */
const ORIGIN_FLARE: Record<Origin, string | null> = {
  map: null,
  calendar: "flea",
  link: "rooftop",
}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const { showActionFeedback } = useActionFeedback()
  const H = useViewportHeight()

  const variant = pick<Variant>(params.get("variant"), ["A", "B"], "A")
  const viewer = pick<FlareViewer>(
    params.get("viewer"),
    ["invited", "joined", "host"],
    "invited"
  )
  const origin = pick<Origin>(
    params.get("from"),
    ["map", "calendar", "link"],
    "map"
  )
  const showBar = params.get("bar") !== "0"

  const [flareId, setFlareId] = useState<string | null>(ORIGIN_FLARE[origin])
  const [open, setOpen] = useState(flareId !== null)
  // An index into snapPoints, which depend on the viewport height.
  const [snapIndex, setSnapIndex] = useState<number | null>(
    Number(pick(params.get("snap"), ["0", "1", "2"], "1"))
  )
  const [nonce, setNonce] = useState(0)
  const [panned, setPanned] = useState(false)

  // On the root, so vaul's portal (outside this tree's DOM) sees them too.
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty("--nav-h", `${NAV_H}px`)
    root.setProperty("--peek-h", `${PEEK_H}px`)
  }, [])

  const update = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) sp.set(k, v)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }

  if (H === null) return null

  const snapPoints: Snap[] =
    variant === "A"
      ? [`${NAV_H + PEEK_H}px`, 0.55, 1]
      : [`${NAV_H + PEEK_H + 12}px`, 0.55, `${H - MAP_STRIP_H}px`]

  const drawerHeight = (s: Snap | null) => {
    if (!open || s === null) return NAV_H
    if (typeof s === "number") return s * H
    return parseFloat(s)
  }
  const snap = snapIndex === null ? null : snapPoints[snapIndex]
  const visibleHeight = H - drawerHeight(snap)
  const flare: MockFlare | null = FLARES.find((f) => f.id === flareId) ?? null

  const openFlare = (f: MockFlare) => {
    setFlareId(f.id)
    setOpen(true)
    setPanned(false)
    setSnapIndex((i) => (i === null || i === 0 ? 1 : i))
  }

  const close = () => {
    setOpen(false)
    if (origin === "calendar") showActionFeedback("prototype: back to calendar")
    else if (origin === "link")
      showActionFeedback("prototype: stays on the home map")
  }

  return (
    <>
      <div className="fixed inset-0 overflow-hidden bg-background">
        <PrototypeMap
          focus={open ? flare : null}
          visibleHeight={visibleHeight}
          focusKey={`${flareId}-${String(snap)}-${variant}-${nonce}`}
          onPinTap={openFlare}
          onUserPan={() => setPanned(true)}
        />

        {/* Back to the flare after panning away. Sits just above the drawer. */}
        {open && flare && panned && visibleHeight > 64 && (
          <button
            type="button"
            onClick={() => {
              setPanned(false)
              setNonce((n) => n + 1)
            }}
            className="absolute left-1/2 z-40 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-background px-3 text-sm font-medium shadow-lg"
            style={{ top: visibleHeight - 52 }}
          >
            <GpsFixIcon className="h-4 w-4 text-primary" /> back to{" "}
            {flare.place.name}
          </button>
        )}

        {showBar && (
          <PrototypeBar
            variant={variant}
            viewer={viewer}
            origin={origin}
            onChange={(next) => {
              update(next)
              if (next.from) {
                const id = ORIGIN_FLARE[next.from as Origin]
                const f = FLARES.find((x) => x.id === id)
                if (f) openFlare(f)
                else setOpen(false)
              }
            }}
          />
        )}

        <FlareDrawer
          key={variant}
          variant={variant}
          flare={flare}
          viewer={viewer}
          open={open}
          snapPoints={snapPoints}
          snap={snap}
          onSnapChange={(s) => {
            setSnapIndex(s === null ? null : snapPoints.indexOf(s))
            setPanned(false)
          }}
          onClose={close}
          onJoin={() => {
            showActionFeedback("you're in")
            update({ viewer: "joined" })
          }}
          onStub={(what) => showActionFeedback(`prototype: ${what}`)}
        />
      </div>
      {/* Outside the map's stacking context, so it sits over vaul's portal. */}
      <FakeNav />
    </>
  )
}

/** Stand-in for the app's bottom nav; the drawer docks above it. */
function FakeNav() {
  const items = [HouseIcon, CalendarBlankIcon, FlameIcon, UsersIcon, UserIcon]
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-around border-t border-border/60 bg-background"
      style={{ height: NAV_H }}
    >
      {items.map((Icon, i) => (
        <span
          key={i}
          className={cn(
            "flex items-center justify-center rounded-full",
            i === 2
              ? "h-11 w-11 bg-primary text-primary-foreground"
              : "h-10 w-10 text-muted-foreground"
          )}
        >
          <Icon className="h-5 w-5" weight={i === 0 ? "fill" : "regular"} />
        </span>
      ))}
    </nav>
  )
}

function PrototypeBar({
  variant,
  viewer,
  origin,
  onChange,
}: {
  variant: Variant
  viewer: FlareViewer
  origin: Origin
  onChange: (next: Record<string, string>) => void
}) {
  return (
    <div className="absolute inset-x-2 top-2 z-[70] flex flex-col gap-1 rounded-2xl bg-zinc-900/90 p-1.5 font-mono text-xs text-zinc-100">
      <div className="flex items-center justify-between gap-1">
        <Seg
          options={[
            { key: "A", label: "A sheet" },
            { key: "B", label: "B card+strip" },
          ]}
          value={variant}
          onChange={(v) => onChange({ variant: v })}
        />
        <Seg
          options={VIEWERS}
          value={viewer}
          onChange={(v) => onChange({ viewer: v })}
        />
      </div>
      <Seg
        options={ORIGINS}
        value={origin}
        onChange={(v) => onChange({ from: v })}
      />
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
    <div className="flex rounded-full bg-zinc-800 p-0.5">
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
