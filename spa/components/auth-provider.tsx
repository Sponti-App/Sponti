"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"
import * as authApi from "@/lib/api/auth"
import { HttpError } from "@/lib/http"
import {
  type AuthUser,
  clearSession,
  readServerSession,
  readSession,
  setSession,
  subscribeSession,
} from "@/lib/auth-store"

type Status = "loading" | "authenticated" | "unauthenticated"

type AuthContextValue = {
  status: Status
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<{ isNewUser: boolean }>
  register: (payload: authApi.RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// #191: only a genuine rejection from the server invalidates a session. A
// network error, a client-side timeout, or a 5xx — including the refresh
// failure http.ts surfaces as `SESSION_REFRESH_FAILED` (#188/#189) — all
// look like "the backend is cold or unreachable right now", not "this
// token is bad". Branch on the HttpError's status, never on message text.
function isSessionRejected(error: unknown): boolean {
  return (
    error instanceof HttpError && (error.status === 401 || error.status === 403)
  )
}

// A cold Render backend (#171) can take a while to answer. A recoverable
// `/auth/me` failure gets one quiet retry after this delay, and another
// whenever the tab regains focus/visibility — whichever fires first keeps
// the cycle going until the check either confirms or genuinely rejects the
// session.
const RETRY_DELAY_MS = 5_000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    subscribeSession,
    readSession,
    readServerSession
  )
  // Tracks which token has been confirmed against /auth/me. Until that check
  // resolves the session is "loading" — guards against stale or revoked tokens.
  const [revalidatedFor, setRevalidatedFor] = useState<string | null>(null)
  // #191: set when /auth/me failed for a recoverable reason (network error,
  // timeout, or 5xx) rather than a genuine rejection. The cached session is
  // still trusted — status treats this the same as "authenticated" — while a
  // quiet retry runs in the background.
  const [pendingRetryFor, setPendingRetryFor] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (session.accessToken && !session.refreshToken) {
      clearSession()
    }
  }, [session.accessToken, session.refreshToken])

  useEffect(() => {
    if (!session.accessToken || !session.refreshToken) return
    if (revalidatedFor === session.accessToken) return

    let cancelled = false
    const accessToken = session.accessToken
    const refreshToken = session.refreshToken

    authApi
      .me()
      .then(({ user: fresh }) => {
        if (cancelled) return
        setSession(accessToken, refreshToken, fresh)
        setRevalidatedFor(accessToken)
        setPendingRetryFor(null)
      })
      .catch((error) => {
        if (cancelled) return
        if (isSessionRejected(error)) {
          // clearSession dispatches a session-change event, which re-runs the
          // useSyncExternalStore snapshot and drops the stored tokens to null.
          clearSession()
          setPendingRetryFor(null)
          return
        }
        // Network error, timeout, or 5xx (#191): the backend may just be
        // cold or briefly unreachable — that's not the same as the server
        // rejecting the token. Keep the cached session and retry quietly
        // instead of forcing the user back to /login.
        setPendingRetryFor(accessToken)
      })

    return () => {
      cancelled = true
    }
    // retryTick has no bearing on *which* token is checked — it only exists
    // to re-run this same check again after a recoverable failure.
  }, [session.accessToken, session.refreshToken, revalidatedFor, retryTick])

  // Quiet retry (#191): re-check once after a short delay, and again as soon
  // as the tab regains focus/visibility — either is a reasonable moment to
  // assume a cold backend has woken up. Re-armed on every fresh failure
  // because `retryTick` is a dependency here too.
  useEffect(() => {
    if (!pendingRetryFor) return

    const retry = () => setRetryTick((tick) => tick + 1)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") retry()
    }

    const timeoutId = window.setTimeout(retry, RETRY_DELAY_MS)
    window.addEventListener("focus", retry)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener("focus", retry)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [pendingRetryFor, retryTick])

  const status: Status = !session.accessToken
    ? "unauthenticated"
    : !session.refreshToken
      ? "unauthenticated"
      : revalidatedFor === session.accessToken
        ? "authenticated"
        : pendingRetryFor === session.accessToken
          ? "authenticated"
          : "loading"

  const handleLogin = useCallback(async (email: string, password: string) => {
    const {
      accessToken,
      refreshToken,
      user: nextUser,
    } = await authApi.login({ email, password })
    setSession(accessToken, refreshToken, nextUser)
    setRevalidatedFor(accessToken)
  }, [])

  const handleGoogleLogin = useCallback(async (credential: string) => {
    const {
      accessToken,
      refreshToken,
      user: nextUser,
      isNewUser,
    } = await authApi.googleLogin(credential)
    setSession(accessToken, refreshToken, nextUser)
    setRevalidatedFor(accessToken)
    return { isNewUser: Boolean(isNewUser) }
  }, [])

  const handleRegister = useCallback(
    async (payload: authApi.RegisterPayload) => {
      const {
        accessToken,
        refreshToken,
        user: nextUser,
      } = await authApi.register(payload)
      setSession(accessToken, refreshToken, nextUser)
      setRevalidatedFor(accessToken)
    },
    []
  )

  const handleLogout = useCallback(async () => {
    const refreshToken = readSession().refreshToken

    try {
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
    } catch {
      // Server failure shouldn't block client-side sign-out.
    }
    clearSession()
    setRevalidatedFor(null)
    setPendingRetryFor(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        status,
        user: session.user,
        login: handleLogin,
        loginWithGoogle: handleGoogleLogin,
        register: handleRegister,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
