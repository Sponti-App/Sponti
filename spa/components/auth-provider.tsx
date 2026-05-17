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
  loginWithGoogle: (credential: string) => Promise<{ isNewUser: boolean }>
  register: (payload: authApi.RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    subscribeSession,
    readSession,
    readServerSession
  )
  // Tracks which token has been confirmed against /auth/me. Until that check
  // resolves the session is "loading" — guards against stale or revoked tokens.
  const [revalidatedFor, setRevalidatedFor] = useState<string | null>(null)

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
      })
      .catch(() => {
        if (cancelled) return
        // clearSession dispatches a session-change event, which re-runs the
        // useSyncExternalStore snapshot and drops the stored tokens to null.
        clearSession()
      })

    return () => {
      cancelled = true
    }
  }, [session.accessToken, session.refreshToken, revalidatedFor])

  const status: Status = !session.accessToken
    ? "unauthenticated"
    : revalidatedFor === session.accessToken
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
