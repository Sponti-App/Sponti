"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/components/event-avatar-stack"
import { haptic } from "@/lib/haptics"
import { cueBell, holdBellBadge, resetJoinBell } from "@/lib/join-bell"
import {
  BELL_SWING_MS,
  JOIN_END,
  JOIN_END_REDUCED,
  JOIN_IMPACT,
  SPARKS,
  joinFrame,
  planJoinBeat,
  type JoinBeat,
  type JoinGeometry,
} from "@/lib/motion/join"
import { useReducedMotion } from "@/lib/motion/reduced-motion"
import {
  subscribeToNotificationArrivals,
  unreadCountNow,
} from "@/lib/use-notifications"
import { cn } from "@/lib/utils"

type QueuedBeat = JoinBeat & { id: number }
type FirstBeat = Extract<QueuedBeat, { kind: "first" }>

/** How long the reduced-motion bell highlight stays on. */
const HIGHLIGHT_MS = 1200

/**
 * The first-join moment (#380), mounted once by the app shell behind
 * `joinMoment`. Each poll that brings joins becomes one beat: the arc overlay
 * for a first join (everyone in that poll stacked), a bell swing for later
 * joins. Beats play one after another, never overlapping.
 */
export function JoinMoment() {
  const reduced = useReducedMotion()
  const [queue, setQueue] = useState<QueuedBeat[]>([])
  const current = queue[0]

  useEffect(() => {
    let id = 0
    const unsubscribe = subscribeToNotificationArrivals((batch) => {
      const beat = planJoinBeat(batch)
      if (!beat) return
      // Runs before the store takes the new count, so this is the old one.
      holdBellBadge(unreadCountNow())
      setQueue((q) => [...q, { ...beat, id: ++id }])
    })
    return () => {
      unsubscribe()
      resetJoinBell()
    }
  }, [])

  const next = () => setQueue((q) => q.slice(1))

  // A later join: the bell swings (or lights up) and the badge pops.
  useEffect(() => {
    if (current?.kind !== "later") return
    haptic("light")
    cueBell(
      reduced ? "highlight" : "swing",
      reduced ? HIGHLIGHT_MS : BELL_SWING_MS
    )
    const timer = setTimeout(next, BELL_SWING_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  if (current?.kind !== "first") return null
  return (
    <FirstJoinOverlay
      key={current.id}
      beat={current}
      reduced={reduced}
      onDone={next}
    />
  )
}

function FirstJoinOverlay({
  beat,
  reduced,
  onDone,
}: {
  beat: FirstBeat
  reduced: boolean
  onDone: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const sparkRefs = useRef<(HTMLSpanElement | null)[]>([])

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const bell = document.querySelector('[data-nav-tab="feed"] svg')
    const geo: JoinGeometry = {
      from: centre(body),
      to: bell && bell.getClientRects().length > 0 ? centre(bell) : null,
    }
    const end = reduced ? JOIN_END_REDUCED : JOIN_END

    const draw = (t: number) => {
      const f = joinFrame(t, geo, reduced)
      body.style.transform = `translate3d(${f.body.x}px, ${f.body.y}px, 0) scale(${f.body.scale})`
      body.style.opacity = String(f.body.opacity)
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${f.ring.scale})`
        ringRef.current.style.opacity = String(f.ring.opacity)
      }
      if (labelRef.current) {
        labelRef.current.style.transform = `translateY(${f.label.y}px)`
        labelRef.current.style.opacity = String(f.label.opacity)
      }
      f.sparks.forEach((s, i) => {
        const el = sparkRefs.current[i]
        if (!el) return
        el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) translate(-50%, -50%) scale(${s.scale})`
        el.style.opacity = String(s.opacity)
      })
    }

    let raf = 0
    let landed = false
    const start = performance.now()
    const step = (now: number) => {
      const t = now - start
      draw(t)
      if (!landed && t >= JOIN_IMPACT) {
        landed = true
        haptic("success")
        cueBell(
          reduced ? "highlight" : "swing",
          reduced ? HIGHLIGHT_MS : BELL_SWING_MS
        )
      }
      if (t >= end) {
        onDone()
        return
      }
      raf = requestAnimationFrame(step)
    }
    draw(0)
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      // Never leave the badge held behind a moment that went away.
      if (!landed) resetJoinBell()
    }
    // One moment per mount: the controller keys it by beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = beat.joiners.slice(0, 3)
  return (
    <div
      data-join-moment={reduced ? "reduced" : "arc"}
      className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
    >
      <p role="status" className="sr-only">
        {beat.title}
      </p>
      <div
        aria-hidden
        className="absolute inset-x-6 top-1/4 flex flex-col items-center"
      >
        <div ref={bodyRef} className="relative opacity-0">
          <span
            ref={ringRef}
            className="absolute inset-0 rounded-full border-2 border-primary opacity-0"
          />
          <div className="flex -space-x-4">
            {shown.map((j) => (
              <Avatar
                key={j.id}
                className={cn(
                  "size-16",
                  shown.length === 1
                    ? "ring-4 ring-primary"
                    : "ring-4 ring-background"
                )}
              >
                {j.avatarUrl && <AvatarImage src={j.avatarUrl} alt="" />}
                <AvatarFallback className="text-base">
                  {initials(j.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
        <div
          ref={labelRef}
          className="mt-3 rounded-xl bg-card px-3 py-2 text-center opacity-0 shadow-(--shadow-card)"
        >
          <p className="text-base font-semibold">{beat.title}</p>
          {beat.detail && (
            <p className="text-xs text-muted-foreground">{beat.detail}</p>
          )}
        </div>
      </div>
      {Array.from({ length: SPARKS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            sparkRefs.current[i] = el
          }}
          aria-hidden
          className="absolute top-0 left-0 size-1.5 rounded-full bg-primary opacity-0"
        />
      ))}
    </div>
  )
}
