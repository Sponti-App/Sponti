"use client"

// The home's floating header row, signed in and signed out: a round button
// on the left, the now/soon toggle in the middle, a pill on the right. All
// three are one height (44px, the touch target) on one glass surface, so the
// row reads as a set. "now" is the map and "soon" the calendar: only the
// labels say so, the views and their data are unchanged.

import type { ComponentProps, ReactNode } from "react"
import { CalendarBlankIcon, MapTrifoldIcon } from "@/components/icons"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

export type HomeView = "map" | "calendar"

const VIEWS = [
  { value: "map", label: "now", Icon: MapTrifoldIcon },
  { value: "calendar", label: "soon", Icon: CalendarBlankIcon },
] as const

/** The glass surface every control in the row shares. */
const SURFACE =
  "pointer-events-auto h-11 rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md dark:bg-background/90"

export function HomeTopBar({
  view,
  onViewChange,
  left,
  right,
}: {
  view: HomeView
  onViewChange: (next: HomeView) => void
  /** A `HeaderIconButton`, or nothing (a spacer keeps the toggle centred). */
  left?: ReactNode
  /** A `HeaderPill`. */
  right: ReactNode
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {left ?? <span aria-hidden="true" className="size-11 shrink-0" />}

      <div
        data-coach="view-toggle"
        className={cn(SURFACE, "flex items-center p-1")}
      >
        {VIEWS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => {
              haptic("selection")
              onViewChange(value)
            }}
            className={cn(
              "flex h-full items-center gap-1.5 rounded-full px-3.5 text-sm font-medium active:scale-[0.97]",
              view === value
                ? "bg-card font-semibold text-foreground"
                : "text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {right}
    </div>
  )
}

/** The round button on the left (the menu). */
export function HeaderIconButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        SURFACE,
        "flex w-11 shrink-0 items-center justify-center active:scale-95",
        className
      )}
      {...props}
    />
  )
}

/** The pill on the right ("invite", "sign in"). */
export function HeaderPill({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        SURFACE,
        "flex shrink-0 items-center justify-center gap-1.5 px-3.5 text-sm font-medium active:scale-95",
        className
      )}
      {...props}
    />
  )
}
