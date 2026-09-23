import { render, act } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useRef, useState } from "react"
import { useFocusedFieldVisible } from "./use-focused-field-visible"

// The hook defers two frames to let useSheetVisibleHeight resize the card
// first, so tests have to drive rAF rather than await a microtask.
async function flushFrames() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/**
 * Mirrors the drawer: the field lives in a scrollable slot, and the slot only
 * appears on a later render — the sheet is portalled, so it is not in the DOM
 * when effects first run. A hook that captures refs at mount misses it.
 */
function Sheet({ mountLate }: { mountLate: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(!mountLate)
  useFocusedFieldVisible(scrollRef, true)

  return (
    <div>
      <button onClick={() => setMounted(true)}>mount</button>
      {mounted ? (
        <div ref={scrollRef} data-testid="slot">
          <input data-testid="field" />
        </div>
      ) : null}
    </div>
  )
}

function stubGeometry(container: HTMLElement) {
  const slot = container.querySelector<HTMLElement>('[data-testid="slot"]')!
  const field = container.querySelector<HTMLElement>('[data-testid="field"]')!

  // A short slot with the field sitting below its bottom edge — what the
  // keyboard leaves behind once the card has shrunk.
  slot.getBoundingClientRect = () => ({ top: 100, bottom: 300 }) as DOMRect
  field.getBoundingClientRect = () => ({ top: 320, bottom: 360 }) as DOMRect

  let scrollTop = 0
  Object.defineProperty(slot, "scrollTop", {
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v
    },
    configurable: true,
  })
  return { slot, field }
}

beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 0) as unknown as number
  )
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useFocusedFieldVisible", () => {
  it("scrolls a clipped field back into the slot on focus", async () => {
    const { container } = render(<Sheet mountLate={false} />)
    const { slot, field } = stubGeometry(container)

    field.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    field.focus()
    await flushFrames()

    expect(slot.scrollTop).toBe(72)
  })

  // Regression guard: an earlier version captured the refs in the mount effect.
  // The drawer portals its content, so the slot did not exist yet and the hook
  // wired itself to nothing — silently, with every test still green.
  it("still works when the slot mounts after the hook", async () => {
    const { container, getByText } = render(<Sheet mountLate />)

    await act(async () => {
      getByText("mount").click()
    })

    const { slot, field } = stubGeometry(container)
    field.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    field.focus()
    await flushFrames()

    expect(slot.scrollTop).toBe(72)
  })

  it("leaves the slot alone when the field is already visible", async () => {
    const { container } = render(<Sheet mountLate={false} />)
    const { slot, field } = stubGeometry(container)
    field.getBoundingClientRect = () => ({ top: 150, bottom: 190 }) as DOMRect

    field.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    field.focus()
    await flushFrames()

    expect(slot.scrollTop).toBe(0)
  })

  it("ignores focus outside the sheet", async () => {
    const { container } = render(<Sheet mountLate={false} />)
    const { slot } = stubGeometry(container)
    const outside = document.createElement("input")
    document.body.appendChild(outside)

    outside.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    outside.focus()
    await flushFrames()

    expect(slot.scrollTop).toBe(0)
    outside.remove()
  })
})
