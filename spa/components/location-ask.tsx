"use client"

// #408 (behind `locationAsk`, flare moments #370): the location ask, in a
// sheet over the map, and the banner a picked area leaves on the map. Copy and
// layout follow the round 2 prototype (#373, PR #407 section 3).
//
// The ask: "where should the map start?" with "use my location" (the
// browser's prompt only comes after this tap) or the berlin area chips. Once
// location is denied or blocked it turns into "pick an area to start": a place
// search, the chips, and a line saying idea spots are berlin-only. Picking a
// place outside berlin opens an empty map there.

import { useEffect, useRef, useState } from "react"
import { Drawer } from "vaul"
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  NavigationArrowIcon,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
import { looksLikeBerlin, matchAreas } from "@/lib/location-ask"
import type { StartArea } from "@/lib/location-choice"

export const LOCATION_ASK_TITLE = "where should the map start?"
export const LOCATION_PICK_TITLE = "pick an area to start"

type Suggestion = { placeId: string; label: string; address: string }

function isSuggestion(value: unknown): value is Suggestion {
  if (typeof value !== "object" || value === null) return false
  const s = value as Partial<Suggestion>
  return (
    typeof s.placeId === "string" &&
    typeof s.label === "string" &&
    typeof s.address === "string"
  )
}

type Search =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; suggestions: Suggestion[] }
  /** The /api/places proxy failed (no key in e2e or local dev): the chips
   * are the search. */
  | { state: "unavailable" }

/**
 * The composer's place search (`WherePicker`), through the same /api/places
 * proxy, unbiased: someone picking an area may be anywhere.
 */
function usePlaceSearch(query: string): Search {
  const [search, setSearch] = useState<Search>({ state: "idle" })
  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) {
      queueMicrotask(() => setSearch({ state: "idle" }))
      return
    }
    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      setSearch({ state: "loading" })
      fetch(`/api/places?${new URLSearchParams({ input: q })}`, {
        signal: ac.signal,
      })
        .then(async (resp) => {
          if (!resp.ok) throw new Error("places error")
          const data = (await resp.json()) as { suggestions?: unknown }
          const suggestions = Array.isArray(data.suggestions)
            ? data.suggestions.filter(isSuggestion)
            : []
          setSearch({ state: "done", suggestions })
        })
        .catch(() => {
          if (!ac.signal.aborted) setSearch({ state: "unavailable" })
        })
    }, 350)
    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [q])
  return search
}

async function placeArea(suggestion: Suggestion): Promise<StartArea> {
  const resp = await fetch(
    `/api/places/${encodeURIComponent(suggestion.placeId)}`
  )
  if (!resp.ok) throw new Error("place details unavailable")
  const data = (await resp.json()) as { lat?: unknown; lng?: unknown }
  if (typeof data.lat !== "number" || typeof data.lng !== "number") {
    throw new Error("place details unavailable")
  }
  return {
    id: suggestion.placeId,
    // The chips and the banner are lowercase, and so is a searched place.
    name: suggestion.label.toLocaleLowerCase(),
    center: { lat: data.lat, lng: data.lng },
  }
}

const CHIP =
  "min-h-9 rounded-full border border-border px-3 text-xs text-foreground active:scale-[0.97]"

/**
 * The ask, in a sheet over the map and the nav. It can't be swiped away: the
 * map needs somewhere to start, and a chip is one tap.
 */
export function LocationAskSheet({
  mode,
  requesting,
  onUseLocation,
  onPick,
}: {
  mode: "hidden" | "ask" | "pick"
  requesting: boolean
  onUseLocation: () => void
  onPick: (area: StartArea) => void
}) {
  const open = mode !== "hidden"
  // Kept while the sheet animates closed.
  const [shown, setShown] = useState<"ask" | "pick">("ask")
  if (open && mode !== shown) setShown(mode)
  const picking = shown === "pick"

  return (
    <Drawer.Root open={open} dismissible={false} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/20" />
        <Drawer.Content
          aria-label="location"
          data-sheet="location"
          data-location-ask={shown}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet) outline-none"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border" />
          <Drawer.Title className="text-base font-semibold">
            {picking ? LOCATION_PICK_TITLE : LOCATION_ASK_TITLE}
          </Drawer.Title>
          <Drawer.Description className="mt-1 text-sm text-muted-foreground">
            {picking
              ? "no problem. you can turn location on later in your browser settings."
              : "so the map opens on what's near you."}
          </Drawer.Description>
          {picking ? (
            <AreaPicker onPick={onPick} />
          ) : (
            <>
              <Button
                type="button"
                disabled={requesting}
                onClick={() => {
                  haptic("medium")
                  onUseLocation()
                }}
                className="mt-4 h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
              >
                <NavigationArrowIcon className="size-4" />
                {requesting ? "finding you…" : "use my location"}
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">
                or pick an area
              </p>
              <AreaChips areas={matchAreas("")} onPick={onPick} />
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function AreaChips({
  areas,
  onPick,
}: {
  areas: StartArea[]
  onPick: (area: StartArea) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {areas.map((area) => (
        <button
          key={area.id}
          type="button"
          onClick={() => {
            haptic("selection")
            onPick(area)
          }}
          className={CHIP}
        >
          {area.name}
        </button>
      ))}
    </div>
  )
}

/** After a denial: a search that finds anywhere, over the berlin chips. */
function AreaPicker({ onPick }: { onPick: (area: StartArea) => void }) {
  const [query, setQuery] = useState("")
  const search = usePlaceSearch(query)
  const [picking, setPicking] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const pickRef = useRef(0)
  const q = query.trim()

  const chips = matchAreas(q)
  const suggestions = search.state === "done" ? search.suggestions : []
  // Without the place search, a query that matches no chip still shows them
  // all, so there's always somewhere to tap.
  const fallback =
    q.length > 0 && chips.length === 0 && search.state === "unavailable"
  const noMatch =
    q.length >= 2 &&
    chips.length === 0 &&
    search.state === "done" &&
    suggestions.length === 0

  const pickSuggestion = async (suggestion: Suggestion) => {
    haptic("selection")
    const id = ++pickRef.current
    setPicking(suggestion.placeId)
    setFailed(false)
    try {
      const area = await placeArea(suggestion)
      if (pickRef.current === id) onPick(area)
    } catch {
      if (pickRef.current === id) setFailed(true)
    } finally {
      if (pickRef.current === id) setPicking(null)
    }
  }

  return (
    <>
      <label className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-muted px-3 text-muted-foreground">
        <MagnifyingGlassIcon className="size-4 shrink-0" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setFailed(false)
          }}
          placeholder="search a neighbourhood or city"
          aria-label="search a neighbourhood or city"
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
          // 16px, so iOS doesn't zoom the page on focus.
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-sm placeholder:text-muted-foreground"
        />
      </label>

      {suggestions.length > 0 && (
        <ul className="mt-2" aria-label="places">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                disabled={picking !== null}
                onClick={() => void pickSuggestion(s)}
                className="flex min-h-11 w-full items-center gap-2 border-b border-border/60 text-left text-sm"
              >
                <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {s.label.toLocaleLowerCase()}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {picking === s.placeId
                    ? "opening…"
                    : looksLikeBerlin(s.label, s.address)
                      ? ""
                      : "no idea spots there yet"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <p className="mt-2 text-xs text-destructive">
          couldn&apos;t open that place, try another
        </p>
      )}
      {fallback && (
        <p className="mt-3 text-xs text-muted-foreground">
          search isn&apos;t available right now. pick an area instead.
        </p>
      )}
      {noMatch && (
        <p className="mt-3 text-xs text-muted-foreground">
          nothing found for “{q}”.
        </p>
      )}

      <AreaChips areas={fallback ? matchAreas("") : chips} onPick={onPick} />

      {!q && (
        <p className="mt-3 text-xs text-muted-foreground">
          idea spots are berlin-only for now. elsewhere the map starts empty.
        </p>
      )}
    </>
  )
}

/**
 * On a picked area: the map says where it is and offers location again. When
 * the browser has location blocked, "use my location" can't prompt any more,
 * so the banner says how to turn it back on.
 */
export function AreaBanner({
  area,
  requesting,
  blocked,
  onUseLocation,
  className = "",
}: {
  area: StartArea
  requesting: boolean
  blocked: boolean
  onUseLocation: () => void
  className?: string
}) {
  return (
    <div
      data-area-banner={area.id}
      className={`pointer-events-auto w-full rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md ${className}`}
    >
      <div className="flex items-center gap-2">
        <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">showing {area.name}</span>
        <button
          type="button"
          disabled={requesting}
          onClick={() => {
            haptic("light")
            onUseLocation()
          }}
          className="flex min-h-8 shrink-0 items-center gap-1 font-medium text-foreground"
        >
          <NavigationArrowIcon className="size-3.5" />
          {requesting ? "finding you…" : "use my location"}
        </button>
      </div>
      {blocked && (
        <p className="mt-1 text-muted-foreground">
          location is blocked for sponti. allow it in your browser&apos;s site
          settings, then tap use my location again.
        </p>
      )}
    </div>
  )
}
