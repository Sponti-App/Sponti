"use client"

// #389 (behind `browseBeforeSignup`): the home screen for a signed-out
// visitor. The same frame as the signed-in home (header chips, map or
// calendar, the bottom nav), with "sign in" where settings sits and nothing
// that loads account data. Everything that needs an account opens one sign-up
// sheet over the map.
//
// The first-run order on #370: the intro slides (#377), then the location ask
// (#408, behind `locationAsk`), which sets SignedOutMap's centre. The coach
// marks wait for an account (#560), so they run on the signed-in home. The top
// bar rework (#369) replaces the header row.
//
// A shared flare link (`/?flare=<id>`) skips the slides and the location ask:
// the map opens on that flare with its card up.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SignedOutBottomNav } from "@/components/bottom-nav"
import { CalendarBlankIcon } from "@/components/icons"
import {
  HeaderPill,
  HomeTopBar,
  type HomeView,
} from "@/components/home-top-bar"
import { IntroSlidesGate } from "@/components/intro-slides-gate"
import { AreaBanner, LocationAskSheet } from "@/components/location-ask"
import { SignUpSheet, type SignUpAsk } from "@/components/sign-up-sheet"
import {
  SIGNED_OUT_AREA_LABEL,
  SIGNED_OUT_CENTER,
  SignedOutMap,
} from "@/components/signed-out-map"
import { haptic } from "@/lib/haptics"
import { useShowIntroSlides } from "@/lib/intro-slides"
import { buildLoginPath } from "@/lib/redirect-path"
import { flarePagePath, useSharedFlare } from "@/lib/shared-flare"
import { useLocationStart } from "@/lib/use-location-start"

export function SignedOutHome() {
  const router = useRouter()
  const [view, setView] = useState<HomeView>("map")
  const [ask, setAsk] = useState<SignUpAsk | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const shared = useSharedFlare()
  const sharing = shared.status !== "none"
  const slidesShowing = useShowIntroSlides() && !sharing

  // #408: where the map starts. The ask waits for the intro slides and the
  // sign-up sheet. With `locationAsk` off the map never
  // asks the browser and stays on berlin, as before. A last known position
  // isn't used: it may be from whoever was signed in on this device before.
  const start = useLocationStart({
    fallback: SIGNED_OUT_CENTER,
    useLastKnown: false,
    alwaysFallback: true,
    requestByDefault: false,
    hold: slidesShowing || askOpen || view !== "map" || sharing,
  })
  const sharedPin = shared.status === "found" ? shared.pin : null
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
            key={
              sharedPin
                ? `shared:${sharedPin.id}`
                : `${start.cameraKey}:${located ? "located" : "start"}`
            }
            center={sharedPin?.position ?? start.camera ?? SIGNED_OUT_CENTER}
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
            shared={
              shared.status === "found"
                ? {
                    status: "found",
                    pin: shared.pin,
                    onJoin: () => openAsk({ kind: "join", flareId: shared.id }),
                  }
                : shared.status === "gone"
                  ? {
                      status: "gone",
                      signInHref: buildLoginPath(flarePagePath(shared.id)),
                    }
                  : undefined
            }
            onPin={() => openAsk({ kind: "pin" })}
            onLightIdea={(idea) => openAsk({ kind: "light", draft: { idea } })}
          />
        ) : (
          <SignedOutCalendar />
        )}

        {/* No menu: it needs an account (#480). */}
        <HomeTopBar
          view={view}
          onViewChange={setView}
          right={
            <HeaderPill
              onClick={() => {
                haptic("selection")
                router.push("/login")
              }}
            >
              sign in
            </HeaderPill>
          }
        />
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

      {/* #377 (behind `introV2`): the intro slides, once per device. Not over
          a shared flare link, which opens on the flare. */}
      {!sharing && <IntroSlidesGate />}
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
