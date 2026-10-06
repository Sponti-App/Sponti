"use client"

// #389 (behind `browseBeforeSignup`): back on the home map after sign-up or
// sign-in with the flare a signed-out visitor started. The auth pages send
// them to `/?resume=flare` (see lib/kept-flare-draft.ts); the kept draft is
// offered once, then the trip back is used up, so a reload or a later visit
// doesn't ask again.
//
// Without a kept draft this is just the first-run intro (#313). With one, the
// welcome back replaces it, as in the #373 prototype: the checklist (#377)
// will take over the intro's job.

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FirstRunIntro } from "@/components/first-run-intro"
import { ideaPrefill } from "@/components/map-view"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { WelcomeBackSheet } from "@/components/sign-up-sheet"
import {
  clearKeptFlareDraft,
  isResumeSearch,
  readKeptFlareDraft,
} from "@/lib/kept-flare-draft"
import { completeOnboarding } from "@/lib/onboarding"

export function KeptDraftWelcome() {
  const router = useRouter()
  const { openDrawer } = useNewEventDrawer()
  const searchParams = useSearchParams()
  const resuming = isResumeSearch(searchParams.toString())
  // Read once, on the render that arrives with `?resume=flare`.
  const [draft] = useState(() => (resuming ? readKeptFlareDraft() : null))
  const [open, setOpen] = useState(draft !== null)

  useEffect(() => {
    if (!resuming) return
    clearKeptFlareDraft()
    if (draft) completeOnboarding()
    router.replace("/")
  }, [resuming, draft, router])

  if (!draft) return <FirstRunIntro />

  return (
    <WelcomeBackSheet
      open={open}
      draft={draft}
      onLight={() => {
        setOpen(false)
        // #124 seam: an account with no friends adds its first friend here,
        // before the kept draft is lit.
        openDrawer(draft.idea ? ideaPrefill(draft.idea) : undefined)
      }}
      onLater={() => setOpen(false)}
    />
  )
}
