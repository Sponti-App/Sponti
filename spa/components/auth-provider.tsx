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
  register: (payload: authApi.RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, readSession, readServerSession)
  // Tracks which token has been confirmed against /auth/me. Until that check
  // resolves the session is "loading" — guards against stale or revoked tokens.
  const [revalidatedFor, setRevalidatedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!session.token) return
    if (revalidatedFor === session.token) return

    let cancelled = false
    const token = session.token

    authApi
      .me()
      .then(({ user: fresh }) => {
        if (cancelled) return
        setSession(token, fresh)
        setRevalidatedFor(token)
      })
      .catch(() => {
        if (cancelled) return
        // clearSession dispatches a session-change event, which re-runs the
        // useSyncExternalStore snapshot and drops session.token to null.
        clearSession()
      })

    return () => {
      cancelled = true
    }
  }, [session.token, revalidatedFor])

  const status: Status = !session.token
    ? "unauthenticated"
    : revalidatedFor === session.token
      ? "authenticated"
      : "loading"

  const handleLogin = useCallback(async (email: string, password: string) => {
    const { accessToken, user: nextUser } = await authApi.login({ email, password })
    setSession(accessToken, nextUser)
    setRevalidatedFor(accessToken)
  }, [])

  const handleRegister = useCallback(async (payload: authApi.RegisterPayload) => {
    const { accessToken, user: nextUser } = await authApi.register(payload)
    setSession(accessToken, nextUser)
    setRevalidatedFor(accessToken)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Server failure shouldn't block client-side sign-out.
    }
    clearSession()
    setRevalidatedFor(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        status,
        user: session.user,
        login: handleLogin,
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
