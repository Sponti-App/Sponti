import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

import { TimeWheel } from "./new-event-drawer"

// #436: the wheel settles 90 ms after the last scroll. When the other wheel
// rebuilds this wheel's list inside that window, the pending settle used the
// list from the render that scheduled it and could pick a value that is no
// longer an option.

const ITEM_H = 36
const opts = (values: number[]) =>
  values.map((v) => ({ value: v, label: `t${v}` }))

/** A listbox whose scrollTop is fixed, like a scroller that is already where
 * the options effect would put it: no scroll event follows a rebuild. */
function pinScrollTop(el: HTMLElement, top: number) {
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: () => {},
  })
}

describe("TimeWheel settle (#436)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("settles on the option the wheel is scrolled to", () => {
    const onChange = vi.fn()
    render(
      <TimeWheel
        options={opts([10, 20, 30, 40])}
        value={10}
        onChange={onChange}
        ariaLabel="end time"
      />
    )
    const wheel = screen.getByRole("listbox", { name: "end time" })
    pinScrollTop(wheel, 2 * ITEM_H)

    fireEvent.scroll(wheel)
    act(() => {
      vi.advanceTimersByTime(90)
    })

    expect(onChange).toHaveBeenCalledExactlyOnceWith(30)
  })

  it("never settles on a value that left the list while the settle was pending", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <TimeWheel
        options={opts([10, 20, 30, 40])}
        value={10}
        onChange={onChange}
        ariaLabel="end time"
      />
    )
    const wheel = screen.getByRole("listbox", { name: "end time" })
    // Scrolled to the last option (40), settle pending.
    pinScrollTop(wheel, 3 * ITEM_H)
    fireEvent.scroll(wheel)

    // The other wheel settles first and the list shrinks: 30 and 40 are gone.
    const shorter = opts([10, 20])
    rerender(
      <TimeWheel
        options={shorter}
        value={10}
        onChange={onChange}
        ariaLabel="end time"
      />
    )
    act(() => {
      vi.advanceTimersByTime(90)
    })

    for (const [picked] of onChange.mock.calls) {
      expect(shorter.map((o) => o.value)).toContain(picked)
    }
    expect(onChange).toHaveBeenCalledExactlyOnceWith(20)
  })

  it("compares against the current value, not the one it was scheduled with", () => {
    const onChange = vi.fn()
    const options = opts([10, 20, 30])
    const { rerender } = render(
      <TimeWheel
        options={options}
        value={10}
        onChange={onChange}
        ariaLabel="end time"
      />
    )
    const wheel = screen.getByRole("listbox", { name: "end time" })
    pinScrollTop(wheel, 1 * ITEM_H)
    fireEvent.scroll(wheel)

    // The parent already moved the value to where the wheel is scrolled.
    rerender(
      <TimeWheel
        options={options}
        value={20}
        onChange={onChange}
        ariaLabel="end time"
      />
    )
    act(() => {
      vi.advanceTimersByTime(90)
    })

    expect(onChange).not.toHaveBeenCalled()
  })
})
