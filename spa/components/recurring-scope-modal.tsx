"use client"

import { Repeat, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export type RecurringScope = "this" | "following" | "all"

const OPTIONS: { value: RecurringScope; label: string; description: string }[] = [
  {
    value: "this",
    label: "this occurrence only",
    description: "leaves the rest of the series untouched",
  },
  {
    value: "following",
    label: "this and following",
    description: "applies to this and every later occurrence",
  },
  {
    value: "all",
    label: "all in the series",
    description: "rewrites every past and future occurrence",
  },
]

export function RecurringScopeModal({
  onPick,
  onClose,
}: {
  onPick: (scope: RecurringScope) => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center px-4 pb-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative w-full bg-card rounded-2xl border border-border shadow-xl flex flex-col">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-accent/10 text-accent flex items-center justify-center">
              <Repeat className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">edit which occurrences?</p>
              <p className="text-xs text-muted-foreground">this is a recurring flare.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <ul className="flex flex-col px-2 pb-2">
          {OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => onPick(opt.value)}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-secondary text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-full">
            cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
