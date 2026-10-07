"use client"

// #389 (behind `browseBeforeSignup`): the home screen for a signed-out
// visitor. The same frame as the signed-in home (header chips, map or
// calendar, the bottom nav), with "sign in" where settings sits and nothing
// that loads account data. Everything that needs an account opens one sign-up
// sheet over the map.
//
// The first-run order on #370: the intro slides (#377), then the coach marks
// (#379, behind `coachMarks`), then the location ask (#408, behind
// `locationAsk`), which sets SignedOutMap's centre. The top bar rework (#369)
// replaces the header row.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SignedOutBottomNav } from "@/components/bottom-nav"
import { CoachMarks } from "@/components/coach-marks"
import { CalendarBlankIcon, MapTrifoldIcon } from "@/components/icons"
import { IntroSlidesGate } from "@/components/intro-slides-gate"
import { AreaBanner, LocationAskSheet } from "@/components/location-ask"
import { SignUpSheet, type SignUpAsk } from "@/components/sign-up-sheet"
import {
  SIGNED_OUT_AREA_LABEL,
  SIGNED_OUT_CENTER,
  SignedOutMap,
} from "@/components/signed-out-map"
import {
  coachMarksVisible,
  markCoachMarksSeen,
  useCoachMarksPending,
} from "@/lib/coach-marks"
import { haptic } from "@/lib/haptics"
import { useShowIntroSlides } from "@/lib/intro-slides"
import { useLocationStart } from "@/lib/use-location-start"

export function SignedOutHome() {
  const router = useRouter()
  const [view, setView] = useState<"map" | "calendar">("map")
  const [ask, setAsk] = useState<SignUpAsk | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const slidesShowing = useShowIntroSlides()
  // #379: the coach marks, once per device, after the slides. Never over the
  // slides, the sign-up sheet or the calendar.
  const marksPending = useCoachMarksPending()
  const marksShowing = coachMarksVisible({
    pending: marksPending,
    slidesShowing,
    sheetOpen: askOpen,
    onMap: view === "map",
  })

  // #408: where the map starts. The ask waits for the intro slides, the
  // coach marks and the sign-up sheet. With `locationAsk` off the map never
  // asks the browser and stays on berlin, as before. A last known position
  // isn't used: it may be from whoever was signed in on this device before.
  const start = useLocationStart({
    fallback: SIGNED_OUT_CENTER,
    useLastKnown: false,
    alwaysFallback: true,
    requestByDefault: false,
    hold: slidesShowing || marksPending || askOpen || view !== "map",
  })
  const located = start.geo.coords != null

  const openAsk = (next: SignUpAsk) => {
    setAsk(next)
    setAskOpen(true)
  }

  return (
    <div className="fixed inset-0 flex w-full flex-col overflow-hidden bg-background">
      <div className="absolute inset-0 overflow-hidden">
        {view === "map" ? (
          <SignedOutMap
            key={`${start.cameraKey}:${located ? "located" : "start"}`}
            center={start.camera ?? SIGNED_OUT_CENTER}
            areaLabel={start.area?.name ?? SIGNED_OUT_AREA_LABEL}
            located={located}
            dockHidden={start.mode !== "hidden"}
            banner={
              start.area ? (
                <AreaBanner
                  area={start.area}
                  requesting={start.requesting}
                  blocked={start.blocked}
                  onUseLocation={start.requestLocation}
                />
              ) : undefined
            }
            onPin={() => openAsk({ kind: "pin" })}
            onLightIdea={(idea) => openAsk({ kind: "light", draft: { idea } })}
          />
        ) : (
          <SignedOutCalendar />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {/* The menu needs an account today; this keeps the toggle centred
              until the top bar rework (#369). */}
          <span aria-hidden="true" className="h-9 w-9" />

          <div
            data-coach="view-toggle"
            className="pointer-events-auto flex items-center rounded-full border border-border/60 bg-background/70 p-1 shadow-sm backdrop-blur-md"
          >
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

      <LocationAskSheet
        mode={start.mode}
        requesting={start.requesting}
        onUseLocation={start.requestLocation}
        onPick={start.pickArea}
      />

      {/* #379 (behind `coachMarks`): the coach marks, once per device. */}
      {marksShowing && <CoachMarks onDone={markCoachMarksSeen} />}

      {/* #377 (behind `introV2`): the intro slides, once per device. */}
      <IntroSlidesGate />
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
