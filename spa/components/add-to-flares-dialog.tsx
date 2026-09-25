"use client"

import { useState } from "react"
import { Check, Flame, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CircleFlare } from "@/lib/api/circles"
import { cn } from "@/lib/utils"

function whenLabel(startAt: string): string {
  const start = new Date(startAt)
  const day =
    start.toDateString() === new Date().toDateString()
      ? "today"
      : start.toLocaleDateString([], { weekday: "short" })
  const time = start
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
  return `${day} ${time}`
}

/**
 * Shown after someone is added to a circle that's already invited to upcoming
 * flares. Circles are snapshots, so nothing happens unless the host says so:
 * every flare starts ticked, and "just the circle" leaves the flares alone.
 */
export function AddToFlaresDialog({
  personName,
  circleName,
  flares,
  busy,
  onConfirm,
  onClose,
}: {
  personName: string
  circleName: string
  flares: CircleFlare[]
  busy?: boolean
  onConfirm: (flareIds: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(flares.map((flare) => flare.id))
  )

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`add ${personName} to your flares too?`}
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative flex w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Flame className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                add {personName} to your flares too?
              </p>
              <p className="text-xs text-muted-foreground">
                {circleName} is invited to{" "}
                {flares.length === 1
                  ? "an upcoming flare"
                  : `${flares.length} upcoming flares`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <ul className="max-h-56 overflow-y-auto overscroll-contain px-2 pb-2">
          {flares.map((flare) => {
            const checked = selected.has(flare.id)
            return (
              <li key={flare.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(flare.id)}
                  disabled={busy}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-secondary disabled:opacity-60"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      checked
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border"
                    )}
                  >
                    {checked && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {flare.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {whenLabel(flare.startAt)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-full"
          >
            just the circle
          </Button>
          <Button
            onClick={() => onConfirm([...selected])}
            disabled={busy || selected.size === 0}
            className="flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy ? "adding..." : "add to flares"}
          </Button>
        </div>
      </div>
    </div>
  )
}
