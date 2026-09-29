"use client"

// PROTOTYPE (#223): throwaway route, NOT production.
// Question: how should the "flares near you" drawer on the home map work?
// Three structurally different approaches (A–C) plus O, a copy of today's
// geometry so the bugs can be reproduced next to the fixes. All on local mock
// data, switchable via URL params:
//   ?variant=O|A|B|C   (default A)
//   &snap=peek|mid|full (default mid)
//   &tab=live|soon|all  (default all)
//   &types=drinks,food  (type filters; exactly one → type-aware CTA)
//   &fs=1               (simulate safari fullscreen: +34px bottom inset, page scrolled)
//   &bar=0              (hide the prototype bar, for screenshots)
// Once the team picks an approach: record the verdict on #223, delete this
// folder, and rebuild the winner properly in components/map-view.tsx.

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import { EVENT_TYPES } from "@/types/utils"
import type { EventType } from "@/lib/api/events"
import { filterFlares, typeInfo, type Snap, type TimeTab } from "./_mock"
import {
  HeaderChips,
  MapBackdrop,
  PrototypeBar,
  VARIANTS,
  useBorderBoxNavHeight,
  type BarState,
  type VariantKey,
  type VariantProps,
} from "./_shared"
import { VariantO } from "./_variant-o"
import { VariantA } from "./_variant-a"
import { VariantB } from "./_variant-b"
import { VariantC } from "./_variant-c"

export default function MapDrawerPrototypePage() {
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

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

const TYPE_KEYS = EVENT_TYPES.map((t) => t.value)

/**
 * Emulates Safari hiding its toolbars: the bottom safe-area inset goes from 0
 * to 34px (home indicator), which grows the real nav (its padding is
 * max(0.5rem, env(safe-area-inset-bottom))) and the body's padding-bottom, and
 * the page has been scrolled (that's what collapses the toolbars). env() can't
 * be overridden, so the same numbers are forced with a style tag.
 */
const FULLSCREEN_CSS = `
  nav[aria-label="Primary"] { padding-bottom: 34px !important; }
  body { padding-bottom: 34px !important; }
`

function useFullscreenSim(on: boolean, key: string) {
  useEffect(() => {
    if (!on) return
    const style = document.createElement("style")
    style.dataset.proto = "fullscreen"
    style.textContent = FULLSCREEN_CSS
    document.head.appendChild(style)
    const raf = requestAnimationFrame(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    )
    return () => {
      cancelAnimationFrame(raf)
      style.remove()
      window.scrollTo(0, 0)
    }
  }, [on, key])
}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const { showActionFeedback } = useActionFeedback()
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const variant = pick<VariantKey>(params.get("variant"), VARIANTS.map((v) => v.key), "A")
  const snap = pick<Snap>(params.get("snap"), ["peek", "mid", "full"], "mid")
  const tab = pick<TimeTab>(params.get("tab"), ["live", "soon", "all"], "all")
  const types = (params.get("types") ?? "")
    .split(",")
    .filter((t): t is EventType => (TYPE_KEYS as string[]).includes(t))
  const fs = params.get("fs") === "1" ? "1" : "0"
  const showBar = params.get("bar") !== "0"

  useFullscreenSim(fs === "1", variant)
  // A–C include the --sponti-nav-h fix; O keeps today's stale-var behaviour
  // (reload on O to see it: once A–C have run, the var is already correct).
  useBorderBoxNavHeight(variant !== "O")

  const update = useCallback(
    (next: Partial<BarState> & { tab?: TimeTab }) => {
      const sp = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(next)) {
        if (v === "") sp.delete(k)
        else sp.set(k, v)
      }
      router.replace(`?${sp.toString()}`, { scroll: false })
    },
    [params, router]
  )

  const flares = filterFlares(tab, types)

  const props: VariantProps = {
    snap,
    onSnap: (s) => update({ snap: s }),
    tab,
    onTab: (t) => update({ tab: t }),
    types,
    onToggleType: (t) =>
      update({
        types: (types.includes(t) ? types.filter((x) => x !== t) : [...types, t]).join(","),
      }),
    onClearTypes: () => update({ types: "" }),
    flares,
    onCta: (type) =>
      showActionFeedback(
        type
          ? `prototype: open composer with "${typeInfo(type).label}" preselected`
          : "prototype: open composer"
      ),
    onOpenFlare: (f) => showActionFeedback(`prototype: open "${f.title}"`),
    onStub: (what) => showActionFeedback(`prototype: ${what}`),
  }

  return (
    <>
      <MapBackdrop flares={flares} highlightId={highlightId} onPin={props.onOpenFlare} />
      <HeaderChips />
      {variant === "O" && <VariantO key="O" {...props} />}
      {variant === "A" && <VariantA key="A" {...props} />}
      {variant === "B" && <VariantB key="B" {...props} />}
      {variant === "C" && <VariantC key="C" {...props} onHighlight={setHighlightId} />}
      {showBar && (
        <PrototypeBar
          variant={variant}
          snap={snap}
          types={types.join(",")}
          fs={fs}
          onChange={update}
        />
      )}
    </>
  )
}
