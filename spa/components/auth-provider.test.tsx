import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/auth-store"

// #191: a signed-in user reopening the app must only be sent to /login when
// the server genuinely rejects the session (`/auth/me` 401/403) — not on a
// network error, a client-side timeout, or a 5xx, all of which look
// identical to "the cold Render backend hasn't woken up yet" (#171) and
// used to clear the session just the same.

const me = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  me,
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

// auth-provider.tsx, http.ts and auth-store.ts all read localStorage/env at
// module load, so each case gets a fresh module graph under a clean store
// (matches the pattern in use-events.test.tsx and http.refresh.test.ts).
async function loadProvider() {
  vi.resetModules()
  const provider = await import("./auth-provider")
  const httpModule = await import("@/lib/http")
  const authStore = await import("@/lib/auth-store")
  return { ...provider, ...httpModule, authStore }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("AuthProvider session revalidation on app open (#191)", () => {
  it("logs out when /auth/me genuinely rejects the token (401)", async () => {
    const { AuthProvider, useAuth, HttpError, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValue(new HttpError(401, "Unauthorized"))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"))
    expect(result.current.user).toBeNull()
    expect(authStore.getToken()).toBeNull()
  })

  it("logs out when /auth/me returns 403", async () => {
    const { AuthProvider, useAuth, HttpError, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValue(new HttpError(403, "Forbidden"))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"))
    expect(authStore.getToken()).toBeNull()
  })

  it("keeps the cached session and renders authenticated when /auth/me times out", async () => {
    const { AuthProvider, useAuth, HttpError, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValue(new HttpError(0, "Request to /auth/me timed out"))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe("authenticated"))
    expect(result.current.user).toEqual(USER)
    expect(authStore.getToken()).toBe("old-access")
    expect(authStore.getRefreshToken()).toBe("old-refresh")
  })

  it("keeps the cached session on a network error from /auth/me", async () => {
    const { AuthProvider, useAuth, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValue(new TypeError("Failed to fetch"))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe("authenticated"))
    expect(result.current.user).toEqual(USER)
    expect(authStore.getToken()).toBe("old-access")
  })

  it("keeps the cached session on a 500 from /auth/me", async () => {
    const { AuthProvider, useAuth, HttpError, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValue(new HttpError(500, "Internal server error"))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe("authenticated"))
    expect(result.current.user).toEqual(USER)
    expect(authStore.getToken()).toBe("old-access")
  })

  it("keeps the cached session when the shared refresh fails to refresh (SESSION_REFRESH_FAILED, #188/#189)", async () => {
    const { AuthProvider, useAuth, HttpError, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValue(
      new HttpError(
        0,
        "Couldn't refresh your session — try again",
        "SESSION_REFRESH_FAILED"
      )
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe("authenticated"))
    expect(result.current.user).toEqual(USER)
    expect(authStore.getToken()).toBe("old-access")
  })

  it("retries quietly on focus and confirms the session once /auth/me succeeds", async () => {
    const { AuthProvider, useAuth, HttpError, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValueOnce(new HttpError(0, "Request to /auth/me timed out"))
    me.mockResolvedValueOnce({ user: USER })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    // The first, recoverable failure already renders the app as authenticated
    // off the cached session.
    await waitFor(() => expect(result.current.status).toBe("authenticated"))
    expect(me).toHaveBeenCalledTimes(1)

    // A tab regaining focus is one of the quiet-retry triggers.
    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
    expect(result.current.status).toBe("authenticated")
    expect(result.current.user).toEqual(USER)
  })

  it("still logs out if a retry after a recoverable failure comes back with a genuine rejection", async () => {
    const { AuthProvider, useAuth, HttpError, authStore } = await loadProvider()
    authStore.setSession("old-access", "old-refresh", USER)
    me.mockRejectedValueOnce(new HttpError(0, "Request to /auth/me timed out"))
    me.mockRejectedValueOnce(new HttpError(401, "Unauthorized"))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    await waitFor(() => expect(result.current.status).toBe("authenticated"))
    expect(me).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"))
    expect(authStore.getToken()).toBeNull()
  })
})
