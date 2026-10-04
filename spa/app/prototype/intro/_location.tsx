"use client"

// PROTOTYPE (#373) — the location ask, in the map's sheet (round 1's B). The
// map opens on berlin with no position; once the coach marks are done, its
// sheet asks. "use my location" → the browser prompt (drawn here). "block",
// or any area chip, → the sheet becomes the area picker: berlin chips (the
// idea spots are berlin-only) and a search field that finds anywhere. A
// place outside berlin opens an empty map, which is a decision on the PR.

import { useState } from "react"
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  NavigationArrowIcon,
} from "@/components/icons"
import { AREAS } from "./_mock"
import { PeachButton, Sheet } from "./_shared"

export const LOCATION_REASON = "so the map opens on what's near you."

export function LocationSheet({
  denied,
  onAllow,
  onPick,
}: {
  /** After "block": the ask turns into the area picker. */
  denied: boolean
  onAllow: () => void
  /** A berlin area id, or "away:<name>". */
  onPick: (loc: string) => void
}) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const matches = q ? AREAS.filter((a) => a.name.includes(q)) : AREAS
  return (
    <Sheet>
      <h2 className="text-base font-semibold">
        {denied ? "pick an area to start" : "where should the map start?"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {denied
          ? "no problem. you can turn location on later in your browser settings."
          : LOCATION_REASON}
      </p>
      {!denied && (
        <PeachButton onClick={onAllow} className="mt-4">
          <NavigationArrowIcon className="size-4" />
          use my location
        </PeachButton>
      )}
      {denied ? (
        <label className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-muted px-3 text-sm text-muted-foreground">
          <MagnifyingGlassIcon className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search a neighbourhood or city"
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">or pick an area</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {matches.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className="min-h-9 rounded-full border border-border px-3 text-xs text-foreground"
          >
            {a.name}
          </button>
        ))}
        {denied && q && matches.length === 0 && (
          <button
            type="button"
            onClick={() => onPick(`away:${q}`)}
            className="flex min-h-11 w-full items-center gap-2 border-b border-border/60 text-left text-sm"
          >
            <MapPinIcon className="size-4 text-muted-foreground" />
            <span className="flex-1">{q}</span>
            <span className="text-xs text-muted-foreground">
              no idea spots there yet
            </span>
          </button>
        )}
      </div>
      {denied && !q && (
        <p className="mt-3 text-xs text-muted-foreground">
          idea spots are berlin-only for now. elsewhere the map starts empty.
        </p>
      )}
    </Sheet>
  )
}

/** Stand-in for the browser's own permission prompt (we can't style it). */
export function BrowserPrompt({
  onAllow,
  onBlock,
}: {
  onAllow: () => void
  onBlock: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 bg-black/30">
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

/** On a picked area: the map says where it is and offers location again. */
export function AreaBanner({
  name,
  onUseLocation,
}: {
  name: string
  onUseLocation: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-background/95 px-3 py-2 text-xs shadow-md">
      <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1">showing {name}</span>
      <button
        type="button"
        onClick={onUseLocation}
        className="flex min-h-8 items-center gap-1 font-medium text-foreground"
      >
        <NavigationArrowIcon className="size-3.5" />
        use my location
      </button>
    </div>
  )
}
