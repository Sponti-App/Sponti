"use client"

import { Check, Loader2 } from "lucide-react"
import { orderCircleChoices } from "@/lib/circle-choices"
import type { Circle } from "@/lib/circles"
import { cn } from "@/lib/utils"

// The "put them in a circle" line shown right after accepting someone
// (#226). One shared component for every place a request gets accepted: the
// notification feed, the circles screen, and later the QR connect flow
// (#124). It only renders; the caller owns the api calls and the state.

export type CircleChoice = Pick<Circle, "id" | "name">

export type CircleChipsState =
  | { status: "choosing" }
  // Tapped, waiting on the api (or, in the feed, on the undo window).
  | { status: "adding"; circle: CircleChoice }
  | { status: "added"; circle: CircleChoice }
  | { status: "skipped" }

export function CircleChips({
  circles,
  personId,
  personName,
  state,
  onPick,
  onSkip,
  className,
}: {
  /** The owner's circles, unfiltered. `null` while they load. */
  circles: Circle[] | null
  personId: string
  personName: string
  state: CircleChipsState
  onPick: (circle: Circle) => void
  onSkip: () => void
  className?: string
}) {
  if (state.status === "added") {
    return (
      <p
        role="status"
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Check className="h-3.5 w-3.5 text-primary" />
        added to {state.circle.name}
      </p>
    )
  }

  if (state.status === "skipped") {
    return (
      <p
        role="status"
        className={cn("text-xs text-muted-foreground", className)}
      >
        you&rsquo;re connected
      </p>
    )
  }

  const busy = state.status === "adding"
  const choices = circles ? orderCircleChoices(circles, personId) : []

  return (
    <div
      role="group"
      aria-label={`add ${personName} to a circle`}
      className={cn("flex flex-col gap-2", className)}
    >
      <p className="text-xs text-muted-foreground">add to a circle</p>
      <div className="flex flex-wrap items-center gap-2">
        {circles === null ? (
          <span className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            loading circles
          </span>
        ) : (
          choices.map((circle) => {
            const selected = busy && state.circle.id === circle.id
            return (
              <button
                key={circle.id}
                type="button"
                disabled={busy}
                aria-pressed={selected}
                onClick={() => onPick(circle)}
                className={cn(
                  "flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-default",
                  selected
                    ? "border-transparent bg-card text-primary"
                    : "border-border text-foreground hover:bg-muted disabled:opacity-50"
                )}
              >
                {selected && <Loader2 className="h-3 w-3 animate-spin" />}
                {circle.name}
              </button>
            )
          })
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="flex h-8 items-center px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          skip
        </button>
      </div>
    </div>
  )
}
