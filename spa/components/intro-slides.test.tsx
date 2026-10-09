import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { IntroSlides } from "./intro-slides"

// #377: the intro slides' controls. The once-per-device state and the flag
// are covered in lib/intro-slides.test.ts, the whole flow in
// e2e/full-profile/intro-slides.spec.ts.

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
}))

const title = () => screen.getByRole("heading", { level: 1 })

beforeEach(() => {
  mocks.push.mockReset()
})

describe("IntroSlides (#377)", () => {
  it("walks what, why, how with next, then look around leaves", () => {
    const onLeave = vi.fn()
    render(<IntroSlides onLeave={onLeave} />)

    expect(title()).toHaveTextContent("plans with friends, right now or soon.")
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    expect(title()).toHaveTextContent(
      "more connected than ever, yet still missing each other."
    )
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    expect(title()).toHaveTextContent("light a flare.")

    // No skip on the last slide: look around is the way out.
    expect(screen.queryByRole("button", { name: "skip" })).toBeNull()
    expect(onLeave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "look around" }))
    expect(onLeave).toHaveBeenCalledOnce()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("moves with the arrow keys and the dots, and Escape skips", () => {
    const onLeave = vi.fn()
    render(<IntroSlides onLeave={onLeave} />)
    const dialog = screen.getByRole("dialog", { name: "welcome to sponti" })

    fireEvent.keyDown(dialog, { key: "ArrowRight" })
    expect(title()).toHaveTextContent("still missing each other")
    fireEvent.keyDown(dialog, { key: "ArrowLeft" })
    expect(title()).toHaveTextContent("plans with friends")
    // Nothing before the first slide.
    fireEvent.keyDown(dialog, { key: "ArrowLeft" })
    expect(title()).toHaveTextContent("plans with friends")

    fireEvent.click(screen.getByRole("button", { name: "slide 3 of 3" }))
    expect(title()).toHaveTextContent("light a flare")
    expect(
      screen.getByRole("button", { name: "slide 3 of 3" })
    ).toHaveAttribute("aria-current", "step")

    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onLeave).toHaveBeenCalledOnce()
  })

  it("swipes between slides", () => {
    render(<IntroSlides onLeave={vi.fn()} />)
    const dialog = screen.getByRole("dialog")
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(dialog, { touches: [{ clientX: from }] })
      fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: to }] })
    }

    swipe(300, 100)
    expect(title()).toHaveTextContent("still missing each other")
    // A short drag isn't a swipe.
    swipe(200, 180)
    expect(title()).toHaveTextContent("still missing each other")
    swipe(100, 300)
    expect(title()).toHaveTextContent("plans with friends")
  })

  it("skip leaves, and i have an account goes to sign in", () => {
    const onLeave = vi.fn()
    render(<IntroSlides onLeave={onLeave} />)

    fireEvent.click(screen.getByRole("button", { name: "i have an account" }))
    expect(mocks.push).toHaveBeenCalledWith("/login")
    expect(onLeave).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "skip" }))
    expect(onLeave).toHaveBeenCalledTimes(2)
  })
})
