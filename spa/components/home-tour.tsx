"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, Map, Sparkles, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { completeHomeTour, shouldShowHomeTour } from "@/lib/onboarding"
import type { AuthUser } from "@/lib/auth-store"

type HomeTourProps = {
  user: AuthUser | null
  onViewChange: (view: "map" | "calendar") => void
}

const tourSteps = [
  {
    title: "Live flares start on the map.",
    body: "Nearby plans from friends show up here when something is happening now or soon.",
    icon: Map,
    view: "map" as const,
    spotlight: "left-6 top-24 h-[58%] w-[calc(100%-3rem)]",
    panel: "bottom-28 left-4 right-4",
  },
  {
    title: "Switch to what is coming up.",
    body: "Calendar view keeps planned flares easy to scan when you are looking ahead.",
    icon: Calendar,
    view: "calendar" as const,
    spotlight: "left-1/2 top-12 h-14 w-44 -translate-x-1/2",
    panel: "bottom-28 left-4 right-4",
  },
  {
    title: "Light your own flare.",
    body: "Tap Host when you know what you want to do, where, and who should see it.",
    icon: Sparkles,
    view: "map" as const,
    spotlight: "left-[98px] bottom-7 h-16 w-16",
    panel: "top-20 left-4 right-4",
  },
  {
    title: "Share with the right people.",
    body: "Circles help you keep plans low-noise by choosing the friends each flare reaches.",
    icon: Users,
    view: "map" as const,
    spotlight: "left-[48px] bottom-7 h-16 w-16",
    panel: "top-20 left-4 right-4",
  },
]

export function HomeTour({ user, onViewChange }: HomeTourProps) {
  const [dismissed, setDismissed] = useState(false)
  const [step, setStep] = useState(0)

  const activeStep = tourSteps[step]
  const visible = Boolean(user && !dismissed && shouldShowHomeTour(user.id))

  useEffect(() => {
    if (visible) onViewChange(activeStep.view)
  }, [activeStep.view, onViewChange, visible])

  const Icon = activeStep.icon
  const progressLabel = useMemo(
    () => `${step + 1} / ${tourSteps.length}`,
    [step]
  )

  if (!visible || !user) return null

  const close = () => {
    completeHomeTour(user.id)
    setDismissed(true)
  }

  const next = () => {
    if (step === tourSteps.length - 1) {
      close()
      return
    }
    setStep((current) => current + 1)
  }

  return (
    <div
      className="absolute inset-0 z-[80] overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-foreground/55 backdrop-blur-[2px]" />
      <div
        className={`pointer-events-none absolute rounded-[28px] border-2 border-accent bg-background/10 shadow-[0_0_0_999px_oklch(0_0_0/16%)] transition-all duration-300 ${activeStep.spotlight}`}
      />

      <div
        className={`absolute rounded-2xl border border-border bg-background p-4 shadow-xl transition-all duration-300 ${activeStep.panel}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon className="size-4" />
            </span>
            <span className="text-sm font-medium text-accent">
              {progressLabel}
            </span>
          </div>
          <button
            type="button"
            aria-label="Skip tour"
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={close}
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 className="mt-4 text-xl leading-tight font-semibold">
          {activeStep.title}
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {activeStep.body}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button
            type="button"
            className="h-11 flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={next}
          >
            {step === tourSteps.length - 1 ? "Start exploring" : "Next"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full"
            onClick={close}
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  )
}
