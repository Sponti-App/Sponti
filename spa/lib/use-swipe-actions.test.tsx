import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  classifyGesture,
  resistedOffset,
  swipeOutcome,
  swipeThreshold,
  useSwipeActions,
} from "./use-swipe-actions"

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

const both = { left: true, right: true }

describe("swipe thresholds (#173)", () => {
  it("waits for a little movement before deciding", () => {
    expect(classifyGesture(4, 3)).toBe("undecided")
  })

  it("treats a mostly sideways drag as a swipe and anything steeper as a scroll", () => {
    expect(classifyGesture(20, 5)).toBe("horizontal")
    expect(classifyGesture(-20, 5)).toBe("horizontal")
    expect(classifyGesture(12, 12)).toBe("vertical")
    expect(classifyGesture(3, 20)).toBe("vertical")
  })

  it("scales the commit distance with the row, within limits", () => {
    expect(swipeThreshold(200)).toBe(72)
    expect(swipeThreshold(375)).toBeCloseTo(112.5)
    expect(swipeThreshold(1200)).toBe(120)
  })

  it("commits only past the threshold, in an allowed direction", () => {
    expect(swipeOutcome(100, 100, both)).toBe("right")
    expect(swipeOutcome(99, 100, both)).toBeNull()
    expect(swipeOutcome(-100, 100, both)).toBe("left")
    expect(swipeOutcome(150, 100, { left: true, right: false })).toBeNull()
  })

  it("resists a direction with nothing behind it", () => {
    expect(resistedOffset(100, both)).toBe(100)
    expect(resistedOffset(100, { left: true, right: false })).toBe(15)
    expect(resistedOffset(-100, { left: false, right: true })).toBe(-15)
  })
})

function Row({
  onSwipeLeft,
  onSwipeRight,
  onClick,
}: {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onClick?: () => void
}) {
  const swipe = useSwipeActions({ onSwipeLeft, onSwipeRight })
  return (
    <div
      data-testid="row"
      {...swipe.handlers}
      style={swipe.style}
      data-offset={swipe.offset}
    >
      <button type="button" onClick={onClick}>
        open
      </button>
    </div>
  )
}

function drag(el: HTMLElement, dx: number, dy = 0) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 200, clientY: 100 })
  fireEvent.pointerMove(el, {
    pointerId: 1,
    clientX: 200 + dx / 2,
    clientY: 100 + dy / 2,
  })
  fireEvent.pointerMove(el, {
    pointerId: 1,
    clientX: 200 + dx,
    clientY: 100 + dy,
  })
}

function release(el: HTMLElement, dx: number, dy = 0) {
  fireEvent.pointerUp(el, {
    pointerId: 1,
    clientX: 200 + dx,
    clientY: 100 + dy,
  })
}

describe("useSwipeActions", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom lays nothing out; give rows a phone-ish width.
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 375,
    })
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("follows the finger sideways and springs back under the threshold", () => {
    const onSwipeLeft = vi.fn()
    render(<Row onSwipeLeft={onSwipeLeft} />)
    const row = screen.getByTestId("row")

    drag(row, -60)
    expect(row.style.transform).toBe("translate3d(-60px, 0, 0)")

    release(row, -60)
    expect(row.dataset.offset).toBe("0")
    vi.runAllTimers()
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it("swipes left past the threshold to hide, after sliding out", () => {
    const onSwipeLeft = vi.fn()
    render(<Row onSwipeLeft={onSwipeLeft} />)
    const row = screen.getByTestId("row")

    drag(row, -150)
    release(row, -150)
    expect(onSwipeLeft).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it("hides straight away with reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    const onSwipeLeft = vi.fn()
    render(<Row onSwipeLeft={onSwipeLeft} />)
    const row = screen.getByTestId("row")

    drag(row, -150)
    release(row, -150)
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it("swipes right past the threshold to accept", () => {
    const onSwipeRight = vi.fn()
    render(<Row onSwipeLeft={vi.fn()} onSwipeRight={onSwipeRight} />)
    const row = screen.getByTestId("row")

    drag(row, 150)
    release(row, 150)
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(row.dataset.offset).toBe("0")
  })

  it("can't swipe right on a row with nothing to accept", () => {
    render(<Row onSwipeLeft={vi.fn()} />)
    const row = screen.getByTestId("row")

    drag(row, 200)
    // Rubber-bands instead of following 1:1.
    expect(row.style.transform).toBe("translate3d(30px, 0, 0)")
  })

  it("leaves a vertical drag alone so the list scrolls", () => {
    const onSwipeLeft = vi.fn()
    render(<Row onSwipeLeft={onSwipeLeft} />)
    const row = screen.getByTestId("row")

    drag(row, -40, 120)
    expect(row.style.transform).toBe("")
    release(row, -150, 120)
    vi.runAllTimers()
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(row.style.touchAction).toBe("pan-y")
  })

  it("swallows the click that ends a drag, but not the next tap", () => {
    const onClick = vi.fn()
    render(<Row onSwipeLeft={vi.fn()} onClick={onClick} />)
    const row = screen.getByTestId("row")
    const button = screen.getByRole("button", { name: "open" })

    drag(row, -40)
    release(row, -40)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()

    fireEvent.pointerDown(row, { pointerId: 2, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(row, { pointerId: 2, clientX: 10, clientY: 10 })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
