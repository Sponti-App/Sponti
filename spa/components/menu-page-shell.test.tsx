import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MenuPageShell } from "./menu-page-shell"
import { InAppHistoryTracker } from "./in-app-history-tracker"
import { markInAppNavigation, resetInAppHistory } from "@/lib/in-app-history"

// #295: the back arrow returns to where the visitor came from, and falls
// back to a fixed page when the page was opened directly.

const mocks = vi.hoisted(() => ({ pathname: "/register" }))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}))

function storeSession(signedIn: boolean) {
  const keys = [
    "sponti.auth.access-token.v1",
    "sponti.auth.refresh-token.v1",
    "sponti.auth.user.v1",
  ]
  for (const key of keys) window.localStorage.removeItem(key)
  if (signedIn) {
    window.localStorage.setItem(keys[0], "access")
    window.localStorage.setItem(keys[1], "refresh")
  }
}

// jsdom can't follow a link and logs "not implemented" for one that isn't
// handled; swallow the default action for clicks that should fall through.
function clickWithoutNavigating(link: HTMLElement, init?: MouseEventInit) {
  const swallow = (event: Event) => event.preventDefault()
  document.addEventListener("click", swallow)
  fireEvent.click(link, init)
  document.removeEventListener("click", swallow)
}

describe("MenuPageShell back arrow (#295)", () => {
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {})

  beforeEach(() => {
    resetInAppHistory()
    storeSession(false)
    back.mockClear()
  })

  afterEach(() => {
    storeSession(false)
  })

  it("is a link named back", () => {
    render(<MenuPageShell title="terms">body</MenuPageShell>)

    expect(screen.getByRole("link", { name: "back" })).toBeInTheDocument()
  })

  it("goes back in history when the visitor navigated inside the app", () => {
    markInAppNavigation()
    render(<MenuPageShell title="terms">body</MenuPageShell>)

    const link = screen.getByRole("link", { name: "back" })
    const notPrevented = fireEvent.click(link)

    expect(back).toHaveBeenCalledTimes(1)
    expect(notPrevented).toBe(false)
  })

  it("falls back to registration when signed out and opened directly", () => {
    render(<MenuPageShell title="terms">body</MenuPageShell>)

    const link = screen.getByRole("link", { name: "back" })
    expect(link).toHaveAttribute("href", "/register")

    clickWithoutNavigating(link)
    expect(back).not.toHaveBeenCalled()
  })

  it("falls back to the menu when signed in and opened directly", () => {
    storeSession(true)
    render(<MenuPageShell title="terms">body</MenuPageShell>)

    expect(screen.getByRole("link", { name: "back" })).toHaveAttribute(
      "href",
      "/menu"
    )
    expect(back).not.toHaveBeenCalled()
  })

  it("leaves modified clicks to the browser", () => {
    markInAppNavigation()
    render(<MenuPageShell title="terms">body</MenuPageShell>)

    clickWithoutNavigating(screen.getByRole("link", { name: "back" }), {
      metaKey: true,
    })

    expect(back).not.toHaveBeenCalled()
  })

  it("keeps a fixed destination when a page asks for one", () => {
    markInAppNavigation()
    render(
      <MenuPageShell title="menu" backHref="/" backLabel="back to home">
        body
      </MenuPageShell>
    )

    const link = screen.getByRole("link", { name: "back to home" })
    expect(link).toHaveAttribute("href", "/")

    clickWithoutNavigating(link)
    expect(back).not.toHaveBeenCalled()
  })
})

describe("InAppHistoryTracker (#295)", () => {
  beforeEach(() => {
    resetInAppHistory()
    storeSession(false)
    mocks.pathname = "/register"
  })

  it("only counts as history once the pathname has changed", () => {
    const { rerender } = render(
      <>
        <InAppHistoryTracker />
        <MenuPageShell title="terms">body</MenuPageShell>
      </>
    )
    expect(screen.getByRole("link", { name: "back" })).toHaveAttribute(
      "href",
      "/register"
    )

    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    back.mockClear()
    clickWithoutNavigating(screen.getByRole("link", { name: "back" }))
    expect(back).not.toHaveBeenCalled()

    mocks.pathname = "/menu/terms"
    rerender(
      <>
        <InAppHistoryTracker />
        <MenuPageShell title="terms">body</MenuPageShell>
      </>
    )
    fireEvent.click(screen.getByRole("link", { name: "back" }))
    expect(back).toHaveBeenCalledTimes(1)
  })
})
