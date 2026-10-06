"use client"

// #389 (behind `browseBeforeSignup`): the home screen for a signed-out
// visitor. The same frame as the signed-in home (header chips, map or
// calendar, the bottom nav), with "sign in" where settings sits and nothing
// that loads account data. Everything that needs an account opens one sign-up
// sheet over the map.
//
// Seams for what comes next on #370: the coach marks (#379) run over this
// screen, the location ask (#408) replaces SignedOutMap's berlin centre, and
// the top bar rework (#369) replaces the header row.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SignedOutBottomNav } from "@/components/bottom-nav"
import { CalendarBlankIcon, MapTrifoldIcon } from "@/components/icons"
import { SignUpSheet, type SignUpAsk } from "@/components/sign-up-sheet"
import { SignedOutMap } from "@/components/signed-out-map"
import { haptic } from "@/lib/haptics"

export function SignedOutHome() {
  const router = useRouter()
  const [view, setView] = useState<"map" | "calendar">("map")
  const [ask, setAsk] = useState<SignUpAsk | null>(null)
  const [askOpen, setAskOpen] = useState(false)

  const openAsk = (next: SignUpAsk) => {
    setAsk(next)
    setAskOpen(true)
  }

  return (
    <div className="fixed inset-0 flex w-full flex-col overflow-hidden bg-background">
      <div className="absolute inset-0 overflow-hidden">
        {view === "map" ? (
          <SignedOutMap
            onPin={() => openAsk({ kind: "pin" })}
            onLightIdea={(idea) => openAsk({ kind: "light", draft: { idea } })}
            onLight={() => openAsk({ kind: "light", draft: { idea: null } })}
          />
        ) : (
          <SignedOutCalendar />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {/* The menu needs an account today; this keeps the toggle centred
              until the top bar rework (#369). */}
          <span aria-hidden="true" className="h-9 w-9" />

          <div className="pointer-events-auto flex items-center rounded-full border border-border/60 bg-background/70 p-1 shadow-sm backdrop-blur-md">
            {(
              [
                ["map", MapTrifoldIcon],
                ["calendar", CalendarBlankIcon],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  haptic("selection")
                  setView(value)
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm active:scale-[0.97] ${
                  view === value
                    ? "bg-card font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{value}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              haptic("selection")
              router.push("/login")
            }}
            className="pointer-events-auto flex h-9 items-center justify-center rounded-full border border-border/60 bg-background/80 px-3 text-sm font-medium shadow-sm backdrop-blur-md active:scale-95 dark:bg-background/90"
          >
            sign in
          </button>
        </div>
      </div>

      <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40">
        <SignedOutBottomNav
          onAccountOnly={(tab) => openAsk({ kind: "account", tab })}
          onFlare={() => openAsk({ kind: "light", draft: { idea: null } })}
        />
      </div>

      <SignUpSheet open={askOpen} ask={ask} onClose={() => setAskOpen(false)} />
    </div>
  )
}

/** The calendar has nothing to list without friends. */
function SignedOutCalendar() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background px-8 text-center">
      <CalendarBlankIcon className="size-6 text-muted-foreground" />
      <p className="mt-3 text-base font-semibold">nothing coming up yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        flares with a picked time land here once you have friends on sponti.
      </p>
    </div>
  )
}
