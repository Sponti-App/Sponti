"use client"

// PROTOTYPE (#506) — throwaway route, NOT production. Nothing links here.
// Question: what should the landing page v2 look like and move like?
// Two directions on mock data, switchable via ?v=a|b; ?bar=0 hides the
// prototype bar (for screenshots). It sits under /landing so it renders
// without the app chrome, like the landing itself (app-chrome.tsx).
// Once Patrick picks: record the verdict on #506, delete this folder, and
// build the winner into components/landing-page.tsx.

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { IntroStyles } from "@/components/intro-slides"
import { cn } from "@/lib/utils"
import { PrototypeStyles } from "./_shared"
import { VariantA } from "./_variant-a"
import { VariantB } from "./_variant-b"

const VARIANTS = {
  a: { label: "a · quiet story", View: VariantA },
  b: { label: "b · pitch", View: VariantB },
} as const

type Key = keyof typeof VARIANTS

function Prototype() {
  const params = useSearchParams()
  const v = (params.get("v") ?? "b") as Key
  const key: Key = v in VARIANTS ? v : "b"
  const { View } = VARIANTS[key]
  const bar = params.get("bar") !== "0"
  return (
    <div
      data-landing-v2
      className="intro-slides relative min-h-dvh bg-background text-foreground"
    >
      <IntroStyles />
      <PrototypeStyles />
      <View />
      {bar && (
        <nav className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-card/95 p-1 text-xs shadow-lg backdrop-blur">
          {(Object.keys(VARIANTS) as Key[]).map((k) => (
            <Link
              key={k}
              href={`?v=${k}`}
              scroll
              className={cn(
                "rounded-full px-3 py-1.5",
                k === key
                  ? "bg-background font-medium text-primary"
                  : "text-muted-foreground"
              )}
            >
              {VARIANTS[k].label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <Prototype />
    </Suspense>
  )
}
