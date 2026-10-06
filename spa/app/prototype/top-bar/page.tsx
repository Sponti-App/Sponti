"use client"

// PROTOTYPE (#369) — throwaway route, NOT production. Nothing links here.
// Question: settings and profile editing move into the top-left menu, and a
// share / qr shortcut replaces the cog at the top right, so a tester can
// invite a friend without searching usernames in circles. Mock data only
// (no api, no auth calls).
//
// The bar switches the open calls, as URL params:
//   ?screen=home|menu|share|friends   what's on screen (share sits over home,
//                                     or over friends with &base=friends)
//   ?auth=in|out                      signed in or signed out header
//   ?menu=A|B                         A: the /menu page with profile and
//                                     settings rows; B: the drawer
//   ?btn=A|B|C                        the shortcut: icon, avatar+, "invite" pill
//   ?open=qr|link                     which tab the share sheet opens on
//   ?card=on|off                      the handle card on the friends screen
//   ?friends=3|0                      friends list or its empty state
//   ?bar=0                            hides the bar (screenshots)
// Once a direction is picked: record it on #369, close the PR, delete this
// folder.

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import { FriendsScreen } from "./_friends"
import { MenuScreen } from "./_menu"
import { ShareScreen } from "./_share"
import {
  MockHome,
  PrototypeBar,
  ProtoStyles,
  TOGGLES,
  type ParamPatch,
  type ProtoState,
} from "./_shared"

export default function TopBarPrototypePage() {
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
  options: readonly { key: T }[]
): T {
  return options.find((o) => o.key === value)?.key ?? options[0].key
}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const { showActionFeedback } = useActionFeedback()

  const state: ProtoState = {
    screen: pick(params.get("screen"), TOGGLES.screen),
    auth: pick(params.get("auth"), TOGGLES.auth),
    menu: pick(params.get("menu"), TOGGLES.menu),
    btn: pick(params.get("btn"), TOGGLES.btn),
    open: pick(params.get("open"), TOGGLES.open),
    card: pick(params.get("card"), TOGGLES.card),
    friends: pick(params.get("friends"), TOGGLES.friends),
    base: params.get("base") === "friends" ? "friends" : "home",
  }
  // Signed out there is no share sheet and no friends screen: the header
  // keeps "sign in", and circles asks for an account.
  if (
    state.auth === "out" &&
    (state.screen === "share" || state.screen === "friends")
  ) {
    state.screen = "home"
  }
  const showBar = params.get("bar") !== "0"

  const go = (patch: ParamPatch) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue
      next.set(k, v)
    }
    router.replace(`?${next.toString()}`, { scroll: false })
  }
  const stub = (what: string) => showActionFeedback(`prototype: ${what}`)
  const props = { state, go, stub }

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950">
      <ProtoStyles />
      {showBar && <PrototypeBar state={state} onChange={go} />}
      <div className="relative mx-auto w-full max-w-[430px] flex-1 overflow-hidden bg-background">
        {state.screen === "menu" ? (
          <MenuScreen {...props} />
        ) : state.screen === "share" ? (
          <ShareScreen {...props} />
        ) : state.screen === "friends" ? (
          <FriendsScreen {...props} />
        ) : (
          <MockHome {...props} />
        )}
      </div>
    </div>
  )
}
