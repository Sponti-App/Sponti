"use client"

// PROTOTYPE (#373) — the location ask. Today the map calls the browser's
// geolocation prompt the moment it mounts, with no reason given, and a
// denial ends in "location needed" + "try again" (which can't re-prompt).
//
// A: its own screen before the map: a one-line reason, then the browser
//    prompt; "block" or "pick an area instead" leads to an area list.
// B: no extra screen: the map opens without a position and its sheet asks,
//    with the areas right there as chips.

import { useState } from "react"
import {
  CheckIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NavigationArrowIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { AREAS, DEFAULT_AREA, ideasNear, mockFlares } from "./_mock"
import {
  MapGrid,
  MapScreen,
  MapStreets,
  PeachButton,
  TextButton,
  UserDot,
  type StepProps,
} from "./_shared"

export const LOCATION_REASON = "so the map opens on flares near you."

// ---- shared pieces (the coach marks section reuses these) -----------------

export function LocationAsk({
  onAllow,
  onPickArea,
}: {
  onAllow: () => void
  onPickArea: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6">
      <div className="flex flex-1 flex-col justify-center">
        <div className="relative mx-auto h-40 w-full overflow-hidden rounded-2xl border border-border bg-muted">
          <MapGrid className="opacity-30" />
          <MapStreets />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="absolute -inset-6 rounded-full bg-accent/15" />
            <UserDot />
          </div>
        </div>
        <h1 className="mt-8 text-lg font-semibold">
          see what&apos;s happening near you
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{LOCATION_REASON}</p>
      </div>
      <div className="flex flex-col gap-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <PeachButton onClick={onAllow}>
          <NavigationArrowIcon className="size-4" />
          use my location
        </PeachButton>
        <TextButton onClick={onPickArea}>pick an area instead</TextButton>
      </div>
    </div>
  )
}

/** Stand-in for the browser's own permission prompt (we can't style it). */
function BrowserPrompt({
  onAllow,
  onBlock,
}: {
  onAllow: () => void
  onBlock: () => void
}) {
  return (
    <div className="absolute inset-0 z-20 bg-black/30">
      <div className="mx-3 mt-3 rounded-xl border border-zinc-300 bg-white p-4 font-sans text-zinc-900 shadow-2xl">
        <p className="text-sm">
          <span className="font-medium">sponti-flame.vercel.app</span> wants to
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <MapPinIcon className="size-4" />
          know your location
        </p>
        <div className="mt-4 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onBlock}
            className="rounded-full border border-zinc-300 px-4 py-1.5"
          >
            block
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-white"
          >
            allow
          </button>
        </div>
        <p className="mt-3 font-mono text-xs text-zinc-500">
          browser prompt, drawn by the prototype
        </p>
      </div>
    </div>
  )
}

export function AreaPicker({
  denied,
  onPick,
}: {
  denied: boolean
  onPick: (id: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-lg font-semibold">pick an area to start</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {denied
          ? "no problem. the map starts here, and you can turn location on later in your browser settings."
          : "the map starts here. you can switch to your location any time."}
      </p>
      <label className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-muted px-3 text-sm text-muted-foreground">
        <MagnifyingGlassIcon className="size-4" />
        <input
          disabled
          placeholder="search a neighbourhood or place"
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      <p className="mt-6 text-xs text-muted-foreground">berlin</p>
      <ul className="mt-2 flex flex-col">
        {AREAS.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => {
                setPicked(a.id)
                window.setTimeout(() => onPick(a.id), 150)
              }}
              className="flex min-h-12 w-full items-center justify-between border-b border-border/60 text-left text-sm"
            >
              {a.name}
              {picked === a.id && <CheckIcon className="size-4 text-primary" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AreaBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-background/95 px-3 py-2 text-xs shadow-md">
      <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1">showing {name}</span>
      <span className="flex items-center gap-1 font-medium text-foreground">
        <NavigationArrowIcon className="size-3.5" />
        use my location
      </span>
    </div>
  )
}

// ---- A: its own screen ----------------------------------------------------

export const LOCATION_A_STEPS = 5

export function LocationOwnScreen({ state, now, go }: StepProps) {
  const area = DEFAULT_AREA
  switch (state.s) {
    case 0:
      return <LocationAsk onAllow={() => go(1)} onPickArea={() => go(2)} />
    case 1:
      return (
        <div className="relative">
          <LocationAsk onAllow={() => {}} onPickArea={() => {}} />
          <BrowserPrompt onAllow={() => go(4)} onBlock={() => go(2)} />
        </div>
      )
    case 2:
      return <AreaPicker denied onPick={() => go(3)} />
    case 3:
      return (
        <MapScreen
          now={now}
          areaLabel={area.name}
          located={false}
          ideas={ideasNear(area.center, now)}
          banner={<AreaBanner name={area.name} />}
        />
      )
    default:
      return (
        <MapScreen
          now={now}
          areaLabel="near you"
          flares={mockFlares(now)}
          ideas={ideasNear(area.center, now)}
        />
      )
  }
}

// ---- B: asked on the map --------------------------------------------------

export const LOCATION_B_STEPS = 3

export function MapLocationSheet({
  onAllow,
  onPick,
}: {
  onAllow: () => void
  onPick: (id: string) => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-background px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet)">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
      <h2 className="text-base font-semibold">where should the map start?</h2>
      <p className="mt-1 text-sm text-muted-foreground">{LOCATION_REASON}</p>
      <PeachButton onClick={onAllow} className="mt-4">
        <NavigationArrowIcon className="size-4" />
        use my location
      </PeachButton>
      <p className="mt-4 text-xs text-muted-foreground">or pick an area</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className={cn(
              "min-h-9 rounded-full border border-border px-3 text-xs text-muted-foreground"
            )}
          >
            {a.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LocationOnMap({ state, now, go }: StepProps) {
  const area = DEFAULT_AREA
  if (state.s === 0)
    return (
      <MapScreen now={now} areaLabel="berlin" located={false}>
        <div className="absolute inset-0 z-10 bg-black/20" />
        <MapLocationSheet onAllow={() => go(2)} onPick={() => go(1)} />
      </MapScreen>
    )
  if (state.s === 1)
    return (
      <MapScreen
        now={now}
        areaLabel={area.name}
        located={false}
        ideas={ideasNear(area.center, now)}
        banner={<AreaBanner name={area.name} />}
      />
    )
  return (
    <MapScreen
      now={now}
      areaLabel="near you"
      flares={mockFlares(now)}
      ideas={ideasNear(area.center, now)}
    />
  )
}
