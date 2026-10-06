"use client"

// #389 (behind `browseBeforeSignup`): back on the home map after sign-up or
// sign-in with the flare a signed-out visitor started. The auth pages send
// them to `/?resume=flare` (see lib/kept-flare-draft.ts); the kept draft is
// offered once, then the trip back is used up, so a reload or a later visit
// doesn't ask again.
//
// Without a kept draft this is just the first-run intro (#313). With one, the
// welcome back replaces it, as in the #373 prototype.
//
// With `introV2` (#459), the post-sign-up checklist in the map's sheet takes
// over the intro's job, so there is no intro here, and a new account keeps
// its checklist after the welcome. An account with no friends adds its first
// friend before the kept draft is lit (#124, decided in #373): "let's light
// it up" opens the first-friend step, and a first connection or a shared
// invite link carries on into the composer. "later" goes back to the map
// and its checklist.

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FirstRunIntro } from "@/components/first-run-intro"
import { ideaPrefill } from "@/components/map-view"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { FirstFriendStep } from "@/components/onboarding-checklist"
import { WelcomeBackSheet } from "@/components/sign-up-sheet"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import { featureFlags } from "@/lib/feature-flags"
import {
  clearKeptFlareDraft,
  isResumeSearch,
  readKeptFlareDraft,
} from "@/lib/kept-flare-draft"
import { completeOnboarding } from "@/lib/onboarding"
import { needsFirstFriendFirst } from "@/lib/onboarding-checklist"

export function KeptDraftWelcome() {
  const router = useRouter()
  const { openDrawer } = useNewEventDrawer()
  const searchParams = useSearchParams()
  const resuming = isResumeSearch(searchParams.toString())
  // Read once, on the render that arrives with `?resume=flare`.
  const [draft] = useState(() => (resuming ? readKeptFlareDraft() : null))
  const [open, setOpen] = useState(draft !== null)
  const [addingFriend, setAddingFriend] = useState(false)
  // #459: the friend count, asked for as soon as there is a draft to light,
  // so "let's light it up" rarely has to wait for it. null when it failed.
  const friendCount = useRef<Promise<number | null> | null>(null)

  useEffect(() => {
    if (!resuming) return
    clearKeptFlareDraft()
    // #459: the checklist replaces the intro and still shows after this.
    if (draft && !featureFlags.introV2) completeOnboarding()
    router.replace("/")
  }, [resuming, draft, router])

  useEffect(() => {
    if (!draft || !featureFlags.introV2 || friendCount.current) return
    friendCount.current = fetchAcceptedConnections()
      .then((connections) => connections.length)
      .catch(() => null)
  }, [draft])

  if (!draft) return featureFlags.introV2 ? null : <FirstRunIntro />

  const light = () =>
    openDrawer(draft.idea ? ideaPrefill(draft.idea) : undefined)

  return (
    <>
      <WelcomeBackSheet
        open={open}
        draft={draft}
        onLight={async () => {
          setOpen(false)
          // #124 before the kept draft is lit: an account with no friends
          // adds its first friend here.
          if (
            featureFlags.introV2 &&
            needsFirstFriendFirst(await (friendCount.current ?? null))
          ) {
            setAddingFriend(true)
            return
          }
          light()
        }}
        onLater={() => setOpen(false)}
      />
      {addingFriend && (
        <FirstFriendStep
          onLater={() => setAddingFriend(false)}
          onConnected={() => {
            setAddingFriend(false)
            light()
          }}
          onShared={() => {
            setAddingFriend(false)
            light()
          }}
        />
      )}
    </>
  )
}
