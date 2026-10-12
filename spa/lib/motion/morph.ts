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
// the sheet, and the strip's slot is measured again on every frame. The
// clone hands over to the real strip at the same place and size, so nothing
// cross-fades. No GSAP here: the morph must start on the tap that opens the
// composer, before any chunk could load.

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
 * How far (px, downwards) the sheet around `el` still has to travel to reach
 * where it rests: its current translateY less its resting one (vaul's
 * `--snap-point-height`, 0 without snap points). The sheet slides in while the
 * morph runs, so the strip's live position starts below the screen; the morph
 * aims at where the strip will rest instead, and only meets the live strip as
 * the sheet lands.
 */
export function sheetDisplacement(el: Element): number {
  if (typeof DOMMatrixReadOnly === "undefined") return 0
  const sheet = el.closest<HTMLElement>("[data-vaul-drawer]")
  if (!sheet) return 0
  const current = new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42
  const rest =
    parseFloat(sheet.style.getPropertyValue("--snap-point-height")) || 0
  return Number.isFinite(current) ? current - rest : 0
}

/** The strip's slot for a frame: the resting slot, easing onto the live one. */
export function slotAt(live: Rect, displacement: number, p: number): Rect {
  const rest = displacement * (1 - p * p * p)
  return { ...live, top: live.top - rest }
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

function toRect(r: DOMRect | null | undefined): Rect | null {
  if (!r || r.width === 0 || r.height === 0) return null
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/**
 * Plays the morph on a clone of `strip`. "open" goes from the nav button to
 * the strip, "close" from the strip back to the button. Both ends are
 * re-measured every frame (the sheet moves). Resolves when done, or at once
 * when either end can't be measured. The returned `cancel` removes the clone.
 */
export function runMorph(options: {
  strip: HTMLElement
  button: () => Element | null
  slot: () => Element | null
  direction: "open" | "close"
  knob: { inset: number; size: number }
  durationMs: number
}): { done: Promise<void>; cancel: () => void } {
  const { strip, direction, knob, durationMs } = options
  let lastSlot = toRect(options.slot()?.getBoundingClientRect())
  let lastButton = toRect(options.button()?.getBoundingClientRect())
  if (!lastSlot || !lastButton) {
    return { done: Promise.resolve(), cancel: () => {} }
  }

  const ghost = strip.cloneNode(true) as HTMLElement
  ghost.removeAttribute("id")
  ghost.setAttribute("aria-hidden", "true")
  ghost.setAttribute("data-flare-morph", direction)
  ghost.removeAttribute("data-testid")
  ghost.tabIndex = -1
  Object.assign(ghost.style, {
    position: "fixed",
    margin: "0",
    zIndex: "62",
    pointerEvents: "none",
    opacity: "1",
    visibility: "visible",
    willChange: "transform, clip-path",
  })
  document.body.appendChild(ghost)

  let frame = 0
  let finish: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })
  const cancel = () => {
    cancelAnimationFrame(frame)
    ghost.remove()
    finish()
  }

  const start = performance.now()
  const paint = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    const slotEl = options.slot()
    lastSlot = toRect(slotEl?.getBoundingClientRect()) ?? lastSlot
    lastButton = toRect(options.button()?.getBoundingClientRect()) ?? lastButton
    const p = direction === "open" ? easeOut(t) : 1 - easeInOut(t)
    const slot = slotEl
      ? slotAt(lastSlot!, sheetDisplacement(slotEl), p)
      : lastSlot!
    const f = morphFrame(lastButton!, slot, p, knob)
    Object.assign(ghost.style, {
      left: `${f.left}px`,
      top: `${f.top}px`,
      width: `${f.width}px`,
      height: `${f.height}px`,
      transform: f.transform,
      transformOrigin: f.transformOrigin,
      clipPath: f.clipPath,
    })
    if (t < 1) frame = requestAnimationFrame(paint)
    else cancel()
  }
  paint(start)
  return { done, cancel }
}
