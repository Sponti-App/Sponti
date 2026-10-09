"use client"

// PROTOTYPE (#522), throwaway route, NOT production.
// Question: when the home "now" map is quiet, what should its sheet say and
// offer? Three takes (A copy-led, B idea-led, C people-led), switchable via
// ?variant=A|B|C, with ?viewer=signedOut|new|friends and ?flares=0|2.
// ?bar=0 hides the prototype bar (for screenshots). Once the team picks a
// take: record it on #522, delete this folder, and build it in map-view.

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import {
  PrototypeBar,
  VARIANTS,
  VIEWERS,
  type Flares,
  type VariantKey,
  type VariantProps,
  type Viewer,
} from "./_shared"
import { VariantA, VariantB, VariantC } from "./_variants"

const COMPONENTS: Record<VariantKey, (p: VariantProps) => React.ReactNode> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
}

export default function HomeNowPrototypePage() {
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

  const variant = pick<VariantKey>(
    params.get("variant"),
    VARIANTS.map((v) => v.key),
    "A"
  )
  const viewer = pick<Viewer>(
    params.get("viewer"),
    VIEWERS.map((v) => v.key),
    "friends"
  )
  const flares = pick<Flares>(params.get("flares"), ["0", "2"], "0")

  const update = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) sp.set(k, v)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }

  const Variant = COMPONENTS[variant]
  return (
    <>
      <Variant
        viewer={viewer}
        flares={flares}
        onStub={(what) => showActionFeedback(`prototype: ${what}`)}
      />
      {params.get("bar") !== "0" && (
        <PrototypeBar
          variant={variant}
          viewer={viewer}
          flares={flares}
          onChange={update}
        />
      )}
    </>
  )
}
