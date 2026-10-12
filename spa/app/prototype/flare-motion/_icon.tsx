"use client"

// PROTOTYPE (#371, round 2) — throwaway. The category icon at its natural
// size (24px), laid over a take's svg. Two stacked copies, unlit and lit,
// so the motion cross-fades them instead of tweening colours.

import type { Icon } from "@/components/icons"
import { overlayAt } from "./_shared"

export function IconLayer({
  Icon,
  x,
  y,
  w,
  h,
  litColour,
  litRef,
  unlitRef,
}: {
  Icon: Icon
  x: number
  y: number
  w: number
  h: number
  litColour: string
  litRef: (el: Element | null) => void
  unlitRef: (el: Element | null) => void
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute size-6"
      style={overlayAt(x, y, w, h)}
    >
      <span ref={unlitRef} className="absolute inset-0 text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <span
        ref={litRef}
        className="absolute inset-0 opacity-0"
        style={{ color: litColour }}
      >
        <Icon className="size-6" />
      </span>
    </div>
  )
}
