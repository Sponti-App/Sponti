import { act, render, screen, waitFor } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/auth-store"

// #219: a signed-in user who cold-loads or refreshes a protected page must
// stay on it, and a signed-out one must be sent to /login with a way back.

const mocks = vi.hoisted(() => ({
  pathname: "/event/event-1",
  replace: vi.fn(),
  me: vi.fn(),
  login: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}))

vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  me: mocks.me,
  login: mocks.login,
}))

const USER: AuthUser = {
  id: "u1",
  username: "flaretester",
  displayName: "Flare Tester",
  email: "flaretester@sponti.test",
  profileVisibility: "public",
  socialBattery: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

// Resolved lazily so the error comes from the same module instance the
// freshly imported provider checks with `instanceof`.
function rejectMeWith(status: number, message: string) {
  mocks.me.mockImplementation(async () => {
    const { HttpError } = await import("@/lib/http")
    throw new HttpError(status, message)
  })
}

function storeSession() {
  window.localStorage.setItem("sponti.auth.access-token.v1", "old-access")
  window.localStorage.setItem("sponti.auth.refresh-token.v1", "old-refresh")
  window.localStorage.setItem("sponti.auth.user.v1", JSON.stringify(USER))
}

// Fresh module graph per case: auth-store keeps a module-level snapshot cache.
async function loadGate() {
  vi.resetModules()
  const { AuthProvider, useAuth } = await import("./auth-provider")
  const { AuthGate } = await import("./auth-gate")
  return { AuthProvider, AuthGate, useAuth }
}

// Mirrors a cold load of the static export: server HTML first (where
// localStorage is invisible), then hydration in the browser.
async function hydrateApp(children: React.ReactNode = <p>flare page</p>) {
  const { AuthProvider, AuthGate } = await loadGate()
  const tree = (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  )
  const container = document.createElement("div")
  container.innerHTML = renderToString(tree)
  document.body.appendChild(container)
  return render(tree, { container, hydrate: true })
}

function setUrl(pathAndQuery: string) {
  window.history.replaceState(null, "", pathAndQuery)
  mocks.pathname = new URL(pathAndQuery, window.location.origin).pathname
}

beforeEach(() => {
  window.localStorage.clear()
  setUrl("/event/event-1?from=share")
})

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ""
})

describe("AuthGate on a cold load or refresh (#219)", () => {
  it("keeps a signed-in user on the protected page while the session is checked", async () => {
    storeSession()
    let answer: (value: { user: AuthUser }) => void = () => {}
    mocks.me.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      })
    )

    await hydrateApp()

    // /auth/me is in flight: spinner, no redirect.
    await waitFor(() => expect(mocks.me).toHaveBeenCalledTimes(1))
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(screen.queryByText("flare page")).not.toBeInTheDocument()

    await act(async () => answer({ user: USER }))

    expect(await screen.findByText("flare page")).toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("keeps a signed-in user on the page when /auth/me fails recoverably (#191)", async () => {
    storeSession()
    rejectMeWith(503, "Service unavailable")

    await hydrateApp()

    expect(await screen.findByText("flare page")).toBeInTheDocument()
    expect(mocks.me).toHaveBeenCalledTimes(1)
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("sends a signed-out user to /login with the page they asked for", async () => {
    await hydrateApp()

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        "/login?redirectTo=%2Fevent%2Fevent-1%3Ffrom%3Dshare"
      )
    )
    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(mocks.me).not.toHaveBeenCalled()
  })

  it("sends a user whose session the server rejects to /login with the page they asked for", async () => {
    storeSession()
    rejectMeWith(401, "Unauthorized")

    await hydrateApp()

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        "/login?redirectTo=%2Fevent%2Fevent-1%3Ffrom%3Dshare"
      )
    )
  })

  it("sends a signed-out user on the home screen to a bare /login", async () => {
    setUrl("/")

    await hydrateApp()

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"))
  })

  it("leaves public pages alone for a signed-out user", async () => {
    for (const path of [
      "/menu/terms",
      "/qr/abc123",
      "/invite/abc123",
      "/login",
    ]) {
      setUrl(path)
      const view = await hydrateApp(<p>public page</p>)
      expect(await screen.findByText("public page")).toBeInTheDocument()
      view.unmount()
      document.body.innerHTML = ""
    }
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})

describe("AuthGate after signing in (#219)", () => {
  function LoginButton({
    useAuth,
  }: {
    useAuth: () => { login: (e: string, p: string) => Promise<void> }
  }) {
    const { login } = useAuth()
    return (
      <button type="button" onClick={() => login("a@b.c", "password123")}>
        sign in
      </button>
    )
  }

  async function signInOn(pathAndQuery: string) {
    setUrl(pathAndQuery)
    mocks.login.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      user: USER,
    })
    const { AuthProvider, AuthGate, useAuth } = await loadGate()
    render(
      <AuthProvider>
        <AuthGate>
          <LoginButton useAuth={useAuth} />
        </AuthGate>
      </AuthProvider>
    )
    await act(async () => screen.getByRole("button").click())
  }

  it("returns the user to the page in redirectTo", async () => {
    await signInOn("/login?redirectTo=%2Fevent%2Fevent-1%3Ffrom%3Dshare")

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/event/event-1?from=share")
    )
  })

  it.each([
    ["an off-site URL", "https%3A%2F%2Fevil.com"],
    ["a protocol-relative URL", "%2F%2Fevil.com"],
    ["a backslash trick", "%2F%5Cevil.com"],
    ["an auth page", "%2Flogin"],
  ])("falls back to home for %s", async (_label, redirectTo) => {
    await signInOn(`/login?redirectTo=${redirectTo}`)

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"))
  })
})
