"use client"

// PROTOTYPE (#371) — throwaway. Gesture A: hold to light. Press and hold the
// button; the fuse burns while the finger stays down and fizzles back if it
// lifts early. Space or enter held down does the same from a keyboard.

import { FlameIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import type { FlareMoment } from "./_stage"

export function HoldVariant({ moment }: { moment: FlareMoment }) {
  const { phase } = moment
  const done = phase === "lit" || phase === "ending" || phase === "ended"
  const label =
    phase === "burning"
      ? "keep holding"
      : phase === "waiting"
        ? "lighting…"
        : done
          ? "lit"
          : "hold to light"

  return (
    <button
      type="button"
      disabled={done || phase === "waiting"}
      data-testid="hold-to-light"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        void moment.startHold()
      }}
      onPointerUp={moment.releaseHold}
      onPointerCancel={moment.releaseHold}
      onLostPointerCapture={moment.releaseHold}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault()
          void moment.startHold()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") moment.releaseHold()
      }}
      className={cn(
        "flex h-14 w-full touch-none items-center justify-center gap-2 rounded-full bg-accent text-base font-semibold text-accent-foreground select-none",
        "active:scale-[0.97] disabled:opacity-60",
        // Once lit, the button steps back so the flare is the only peach.
        done && "bg-muted text-muted-foreground disabled:opacity-100",
        phase === "burning" && "scale-[0.97]"
      )}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
    >
      <FlameIcon className="size-6" />
      {label}
    </button>
  )
}
