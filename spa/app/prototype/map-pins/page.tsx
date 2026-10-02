"use client"

// PROTOTYPE (#315): throwaway route, NOT production. Nothing links here.
// Question: how should flare pins and the pin popover look, so a viewer can
// tell invite-only from open-to-all (the main axis), an idea from a flare,
// their own and joined flares, and live from starts-soon?
// Three options on local mock data over a static map stand-in, switchable via
// URL params:
//   ?option=A|B|C            (default A: shape-led, B: colour-led, C: badge-led)
//   &popover=none|private|public   (default none)
//   &theme=light|dark        (sets the app theme while on this page)
//   &notes=0                 (hide the dashed prototype notes)
//   &bar=0                   (hide the prototype bar, for screenshots)
// Tapping a pin also opens its popover. Once an option is picked: record the
// verdict on #315, delete this folder, and build the winner in
// components/map-view.tsx as a follow-up issue.

import { Suspense, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useActionFeedback } from "@/components/action-feedback"
import { IDEA, PINS, type PopoverKey } from "./_mock"
import {
  MapStandIn,
  MeDot,
  Note,
  PROTO_CSS,
  PopoverFrame,
  PrototypeBar,
  type BarState,
  type OptionDef,
  type OptionKey,
} from "./_shared"
import { OPTION_A } from "./_option-a"
import { OPTION_B } from "./_option-b"
import { OPTION_C } from "./_option-c"

const OPTIONS: OptionDef[] = [OPTION_A, OPTION_B, OPTION_C]

export default function MapPinsPrototypePage() {
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

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const { showActionFeedback } = useActionFeedback()
  const { resolvedTheme, setTheme } = useTheme()

  const option = pick<OptionKey>(params.get("option"), ["A", "B", "C"], "A")
  const popover = pick<PopoverKey>(
    params.get("popover"),
    ["none", "private", "public"],
    "none"
  )
  const themeParam = params.get("theme")
  const notes = params.get("notes") !== "0"
  const showBar = params.get("bar") !== "0"

  // The theme is the app's own (next-themes), so the nav and page background
  // follow too. Only touched when the URL asks for one.
  useEffect(() => {
    if (themeParam === "light" || themeParam === "dark") setTheme(themeParam)
  }, [themeParam, setTheme])

  const update = useCallback(
    (next: Partial<BarState>) => {
      const sp = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(next)) {
        sp.set(k, typeof v === "boolean" ? (v ? "1" : "0") : v)
      }
      router.replace(`?${sp.toString()}`, { scroll: false })
    },
    [params, router]
  )

  const def = OPTIONS.find((o) => o.key === option)!
  const open = popover === "none" ? null : PINS.find((p) => p.id === popover)
  const { Pin, Idea, Popover, Legend } = def

  return (
    <div className="proto-315">
      <style>{PROTO_CSS}</style>
      <div
        className="fixed inset-x-0 top-0 overflow-hidden bg-background"
        style={{ bottom: "var(--sponti-nav-h, 64px)" }}
      >
        <MapStandIn />

        <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-1.5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {notes && (
            <Note wrap>
              {def.key} · {def.name}: {def.rule}
            </Note>
          )}
          {Legend && <Legend />}
        </div>

        <MeDot />

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${IDEA.x}%`, top: `${IDEA.y}%` }}
        >
          <button
            type="button"
            aria-label={`idea: ${IDEA.title}`}
            onClick={() => showActionFeedback("ideas open the quiet card")}
            className="flex flex-col items-center p-2"
          >
            <Idea idea={IDEA} />
          </button>
          {notes && (
            <div className="absolute top-full left-1/2 -translate-x-1/2">
              <Note>{IDEA.note}</Note>
            </div>
          )}
        </div>

        {PINS.map((pin) => (
          <div
            key={pin.id}
            className={`absolute -translate-x-1/2 ${open?.id === pin.id ? "z-20" : "z-10"}`}
            // Centre the 40px pin on its point; the chip and note hang below.
            style={{
              left: `${pin.x}%`,
              top: `calc(${pin.y}% - 20px)`,
            }}
          >
            <button
              type="button"
              data-flare-pin={pin.id}
              aria-label={`flare: ${pin.title}`}
              onClick={() =>
                update({
                  popover:
                    open?.id === pin.id
                      ? "none"
                      : pin.id === "private" || pin.id === "public"
                        ? pin.id
                        : "none",
                })
              }
              className="flex flex-col items-center"
            >
              <Pin pin={pin} selected={open?.id === pin.id} />
            </button>
            {notes && (
              <div className="mt-0.5 flex justify-center">
                <Note>{pin.note}</Note>
              </div>
            )}
          </div>
        ))}

        {open && (
          <PopoverFrame pin={open} width={def.popoverWidth}>
            <Popover
              pin={open}
              onOpen={() => showActionFeedback(`would open /event/${open.id}`)}
              onClose={() => update({ popover: "none" })}
            />
          </PopoverFrame>
        )}
      </div>

      {showBar && (
        <PrototypeBar
          state={{
            option,
            popover,
            theme: resolvedTheme === "dark" ? "dark" : "light",
            notes,
          }}
          options={OPTIONS}
          onChange={update}
        />
      )}
    </div>
  )
}
