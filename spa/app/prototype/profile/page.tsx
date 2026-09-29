"use client"

// PROTOTYPE (#166): throwaway route, NOT production. Nothing links here.
// Question: how should the rebuilt profile look and work, within Patrick's
// scope (photo from google, one-line bio, instagram + telegram handles; bio
// and socials for connections only)? Three approaches on local mock data,
// switchable via URL params:
//   ?approach=A|B|C          (default A)
//   &view=other|own          (someone else's profile, or yours; default other)
//   &viewer=friend|stranger|pending|youblocked|blockedby   (default friend)
//   &bar=0                   (hide the prototype bar, for screenshots)
// Once an approach is picked: record the verdict on #166, delete this folder,
// and build the winner in app/profile/[username] and the settings page.

import { Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import { ME, THEM } from "./_mock"
import {
  APPROACHES,
  PrototypeBar,
  VIEWERS,
  type ApproachKey,
  type View,
  type Viewer,
} from "./_shared"
import { ApproachA } from "./_approach-a"
import { ApproachB } from "./_approach-b"
import { ApproachC } from "./_approach-c"

export default function ProfilePrototypePage() {
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

  const approach = pick<ApproachKey>(
    params.get("approach"),
    APPROACHES.map((a) => a.key),
    "A"
  )
  const view = pick<View>(params.get("view"), ["other", "own"], "other")
  const viewer = pick<Viewer>(
    params.get("viewer"),
    VIEWERS.map((v) => v.key),
    "friend"
  )
  const showBar = params.get("bar") !== "0"

  const update = useCallback(
    (next: Partial<{ approach: ApproachKey; view: View; viewer: Viewer }>) => {
      const sp = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(next)) sp.set(k, v)
      router.replace(`?${sp.toString()}`, { scroll: false })
    },
    [params, router]
  )

  const props = {
    view,
    viewer,
    person: THEM,
    me: ME,
    onToast: (message: string) => showActionFeedback(message),
  }
  const Approach = { A: ApproachA, B: ApproachB, C: ApproachC }[approach]

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background pb-40">
      {/* Remount per approach/view so each starts from its own clean state. */}
      <Approach key={`${approach}-${view}-${viewer}`} {...props} />
      {showBar && (
        <PrototypeBar
          approach={approach}
          view={view}
          viewer={viewer}
          onChange={update}
        />
      )}
    </div>
  )
}
