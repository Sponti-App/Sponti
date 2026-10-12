// The flare button's morph (#376): the bottom nav's round flare button
// becomes the composer's strike strip when the composer opens, and turns
// back into the button when it closes.
//
// The strip is a pill whose round peach knob sits at its left end. At p = 0
// the strip is clipped down to a circle around the knob, scaled to the nav
// button's size and moved onto it, so it looks exactly like the button. At
// p = 1 it is the strip in its slot. In between, the circle travels and opens
// out sideways into the pill: one element changing position, size and shape.
//
// The strip lives inside the composer sheet, which slides while the morph
// runs, so the morph is drawn on a clone of the strip in a fixed layer above
// the sheet. The clone does not follow the strip while the sheet moves:
//
// - Opening, it flies to where the strip will rest (`rest`), on the sheet's
//   own curve and duration, so the pill and the sheet arrive together. Only
//   in its last stretch does it ease onto the live strip, which by then is
//   where it rests, so the hand-over can't jump. (Following the live strip
//   sent the clone off the bottom of the screen and back up: the sheet starts
//   below the screen, and its card is squashed while it slides in.)
// - Closing, it leaves from where the strip was when the close began, and the
//   sheet slides away under it.
//
// While the clone stands in, the real strip is see-through (set here, in the
// same frame as the clone appears and goes, with its opacity transition off),
// so the two never show at once and there is no frame with neither. It stays
// a live button underneath: a quick strike during the morph still lands. No GSAP here: the morph must start
// on the tap that opens the composer, before any chunk could load.

export type Rect = { left: number; top: number; width: number; height: number }

export type MorphFrame = {
  /** Where the clone sits: the strip's slot. */
  left: number
  top: number
  width: number
  height: number
  transform: string
  transformOrigin: string
  clipPath: string
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * The clone's place and shape at progress `p` (0 = the nav button, 1 = the
 * strip). `knob` is the knob's inset from the strip's edge and its diameter.
 */
export function morphFrame(
  button: Rect,
  slot: Rect,
  p: number,
  knob: { inset: number; size: number }
): MorphFrame {
  const knobCx = slot.left + knob.inset + knob.size / 2
  const knobCy = slot.top + slot.height / 2
  const buttonCx = button.left + button.width / 2
  const buttonCy = button.top + button.height / 2
  const dx = (buttonCx - knobCx) * (1 - p)
  const dy = (buttonCy - knobCy) * (1 - p)
  const scale = lerp(button.width / knob.size, 1, p)
  const circle = knob.inset * 2 + knob.size
  const clipRight = Math.max(0, slot.width - circle) * (1 - p)
  const clipY = Math.max(0, (slot.height - circle) / 2) * (1 - p)
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    left: slot.left,
    top: slot.top,
    width: slot.width,
    height: slot.height,
    transform: `translate(${r(dx)}px, ${r(dy)}px) scale(${r(scale)})`,
    transformOrigin: `${knob.inset + knob.size / 2}px 50%`,
    clipPath: `inset(${r(clipY)}px ${r(clipRight)}px ${r(clipY)}px 0px round 9999px)`,
  }
}

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)` as a function of time (0..1), so the
 * clone can move on the same curve as the sheet (vaul's is
 * cubic-bezier(0.32, 0.72, 0, 1)).
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const x = (s: number) => ((ax * s + bx) * s + cx) * s
  const y = (s: number) => ((ay * s + by) * s + cy) * s
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    // Newton first, bisection if the slope is too flat.
    let s = t
    for (let i = 0; i < 8; i++) {
      const err = x(s) - t
      if (Math.abs(err) < 1e-6) return y(s)
      const d = dx(s)
      if (Math.abs(d) < 1e-6) break
      s -= err / d
    }
    let lo = 0
    let hi = 1
    s = t
    for (let i = 0; i < 30; i++) {
      const v = x(s)
      if (Math.abs(v - t) < 1e-6) break
      if (v < t) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return y(s)
  }
}

/** vaul's sheet curve: the clone opens and closes on it. */
export const SHEET_EASE = cubicBezier(0.32, 0.72, 0, 1)

/**
 * Where the clone aims at time `t` (0..1) of an open: the strip's resting
 * slot, easing onto the live strip only over the last quarter, when the sheet
 * has all but landed. Without a live strip it is the resting slot throughout.
 */
export function openSlotAt(rest: Rect, live: Rect | null, t: number): Rect {
  if (!live) return rest
  const w = clamp01((t - 0.75) / 0.25) ** 2
  return {
    left: lerp(rest.left, live.left, w),
    top: lerp(rest.top, live.top, w),
    width: lerp(rest.width, live.width, w),
    height: lerp(rest.height, live.height, w),
  }
}

function toRect(r: DOMRect | null | undefined): Rect | null {
  if (!r || r.width === 0 || r.height === 0) return null
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** The strip's own opacity (it is dimmed while disabled), under ours. */
function naturalOpacity(el: HTMLElement): number {
  const set = el.style.opacity
  el.style.opacity = ""
  const o = parseFloat(getComputedStyle(el).opacity)
  el.style.opacity = set
  return Number.isFinite(o) ? o : 1
}

/**
 * Plays the morph on a clone of `strip`. "open" goes from the nav button to
 * the strip, "close" from the strip back to the button. `rest` is where the
 * strip will rest once the sheet has landed (opening only; without it the
 * clone aims at the live strip). Resolves `done` when the clone has arrived;
 * the clone then stays put, still standing in, until `finish` (hand over:
 * the clone goes and the strip shows, in one frame) or `cancel`.
 */
export function runMorph(options: {
  strip: HTMLElement
  button: () => Element | null
  rest?: () => Rect | null
  direction: "open" | "close"
  knob: { inset: number; size: number }
  durationMs: number
  ease?: (t: number) => number
}): { done: Promise<void>; finish: () => void; cancel: () => void } {
  const { strip, direction, knob, durationMs } = options
  const ease = options.ease ?? SHEET_EASE
  const liveSlot = () => toRect(strip.getBoundingClientRect())
  // Closing leaves from where the strip is now, and stays there: the sheet
  // slides away under the clone.
  const from = liveSlot()
  let lastButton = toRect(options.button()?.getBoundingClientRect())
  let lastRest = options.rest?.() ?? null
  if (!from || !lastButton) {
    return { done: Promise.resolve(), finish: () => {}, cancel: () => {} }
  }

  const ghost = strip.cloneNode(true) as HTMLElement
  ghost.removeAttribute("id")
  ghost.setAttribute("aria-hidden", "true")
  ghost.setAttribute("data-flare-morph", direction)
  ghost.removeAttribute("data-testid")
  ghost.removeAttribute("data-strike-strip")
  ghost.tabIndex = -1
  Object.assign(ghost.style, {
    position: "fixed",
    margin: "0",
    zIndex: "62",
    pointerEvents: "none",
    visibility: "visible",
    transition: "none",
    willChange: "transform, clip-path, opacity",
  })
  document.body.appendChild(ghost)
  const stripStyle = {
    opacity: strip.style.opacity,
    transition: strip.style.transition,
  }
  strip.style.transition = "none"
  strip.style.opacity = "0"

  let frame = 0
  let resolve: () => void = () => {}
  const done = new Promise<void>((r) => {
    resolve = r
  })
  let ended = false
  const finish = () => {
    if (ended) return
    ended = true
    cancelAnimationFrame(frame)
    strip.style.opacity = stripStyle.opacity
    // Applied before the transition comes back, so the strip doesn't fade in.
    void getComputedStyle(strip).opacity
    strip.style.transition = stripStyle.transition
    ghost.remove()
    resolve()
  }

  const start = performance.now()
  const paint = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    lastButton = toRect(options.button()?.getBoundingClientRect()) ?? lastButton
    let slot: Rect
    let p: number
    if (direction === "open") {
      lastRest = options.rest?.() ?? lastRest
      const live = liveSlot()
      slot = lastRest ? openSlotAt(lastRest, live, t) : (live ?? from)
      p = ease(t)
    } else {
      slot = from
      p = 1 - ease(t)
    }
    const f = morphFrame(lastButton!, slot, p, knob)
    Object.assign(ghost.style, {
      left: `${f.left}px`,
      top: `${f.top}px`,
      width: `${f.width}px`,
      height: `${f.height}px`,
      transform: f.transform,
      transformOrigin: f.transformOrigin,
      clipPath: f.clipPath,
      // The button is solid; the strip may be dimmed (disabled).
      opacity: String(lerp(1, naturalOpacity(strip), p)),
    })
    if (t < 1) frame = requestAnimationFrame(paint)
    else resolve()
  }
  paint(start)
  return { done, finish, cancel: finish }
}
