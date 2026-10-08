"use client"

// #506: the landing page's motion, without a library. IntersectionObserver
// for reveals, and scroll and pointer listeners that write CSS variables
// (`--p`, `--mx`, `--my`, `--sx`, `--sy`) so the browser does the rest
// without React re-rendering. Reduced motion gets each final state: scroll
// variables rest at a fixed value and nothing listens.

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const REDUCED = "(prefers-reduced-motion: reduce)"

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(REDUCED)
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2)
  return (
    <div
      ref={ref}
      data-shown={inView}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("lp-reveal", className)}
    >
      {children}
    </div>
  )
}

/**
 * Writes `--p` on the element: 0 when its top meets the viewport's bottom,
 * 1 when its bottom leaves the top. With reduced motion it stays at `rest`,
 * the value the section's final state reads from.
 */
export function useScrollVar<T extends HTMLElement>(rest = 0.5) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia(REDUCED).matches) {
      el.style.setProperty("--p", String(rest))
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const total = box.height + window.innerHeight
      const p = Math.min(1, Math.max(0, (window.innerHeight - box.top) / total))
      el.style.setProperty("--p", p.toFixed(4))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [rest])
  return ref
}

/**
 * Writes `--q` on a tall element whose child is `position: sticky`: 0 while
 * its top is at the viewport's top, 1 once it has scrolled its extra height
 * (its height minus the viewport's) and the sticky child lets go. Reduced
 * motion keeps it at 0.
 */
export function usePinProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia(REDUCED).matches) return
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const room = Math.max(1, box.height - window.innerHeight)
      const q = Math.min(1, Math.max(0, -box.top / room))
      el.style.setProperty("--q", q.toFixed(4))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])
  return ref
}

/**
 * True while the element's `--p` (from useScrollVar) is past `at`, with a
 * little slack so it doesn't flicker at the edge. Scrolling back turns it off,
 * so the moment plays again on the way down.
 */
export function useScrolledPast(
  ref: React.RefObject<HTMLElement | null>,
  at: number
) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const check = () => {
      frame = 0
      const p = Number(el.style.getPropertyValue("--p") || 0)
      setPast((was) => (was ? p > at - 0.05 : p >= at))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    check()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [ref, at])
  return past
}

/**
 * Writes `--mx` / `--my` (-1..1, from the pointer's position over the
 * window) on the element. Desktop pointers only; touch and reduced motion
 * leave both at 0.
 */
export function usePointerVar<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)")
    if (!fine.matches || window.matchMedia(REDUCED).matches) return
    let frame = 0
    let x = 0
    let y = 0
    const apply = () => {
      frame = 0
      el.style.setProperty("--mx", x.toFixed(3))
      el.style.setProperty("--my", y.toFixed(3))
    }
    const onMove = (event: PointerEvent) => {
      x = (event.clientX / window.innerWidth) * 2 - 1
      y = (event.clientY / window.innerHeight) * 2 - 1
      if (!frame) frame = requestAnimationFrame(apply)
    }
    window.addEventListener("pointermove", onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", onMove)
    }
  }, [])
  return ref
}

/** A transform that moves a layer with the cursor by `px`. */
export function depth(px: number) {
  return `translate3d(calc(var(--mx, 0) * ${px}px), calc(var(--my, 0) * ${px}px), 0)`
}

/** Hover spotlight: writes the pointer's position inside the element. */
export function spotlight(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget
  const box = el.getBoundingClientRect()
  el.style.setProperty("--sx", `${event.clientX - box.left}px`)
  el.style.setProperty("--sy", `${event.clientY - box.top}px`)
}

/** Types each word, holds it, deletes it, and moves on. Reduced motion
 * shows the first word, still. Screen readers hear only the first word, so
 * the heading doesn't keep changing under them. Every word sits invisible in
 * the same grid cell, so the box keeps the longest word's size and the
 * heading never reflows as words come and go. */
export function Typewriter({
  words,
  className,
}: {
  words: string[]
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [chars, setChars] = useState(words[0].length)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    if (reduced) return
    const word = words[index]
    const timer = window.setTimeout(
      () => {
        if (!deleting && chars < word.length) setChars(chars + 1)
        else if (!deleting) setDeleting(true)
        else if (chars > 0) setChars(chars - 1)
        else {
          setDeleting(false)
          setIndex((index + 1) % words.length)
        }
      },
      !deleting && chars === word.length ? 1600 : deleting ? 45 : 85
    )
    return () => window.clearTimeout(timer)
  }, [reduced, words, index, chars, deleting])
  const shown = reduced ? words[0] : words[index].slice(0, chars)
  return (
    <>
      <span className="sr-only">{words[0]}</span>
      <span aria-hidden="true" className="inline-grid align-bottom">
        {words.map((word) => (
          <span key={word} className="invisible [grid-area:1/1]">
            {word}
            <span className="ml-0.5 inline-block w-[3px]" />
          </span>
        ))}
        <span data-typewriter className={cn("[grid-area:1/1]", className)}>
          {shown}
          <span className="lp-caret ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-full bg-current" />
        </span>
      </span>
    </>
  )
}
