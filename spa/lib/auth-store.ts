// Token + user persistence. Plain localStorage for v1 — works in Next on the
// web and inside Capacitor's WebView. Move to @capacitor/preferences when we
// want native-secure storage.

const TOKEN_KEY = "sponti.auth.token.v1"
const USER_KEY = "sponti.auth.user.v1"
const CHANGE_EVENT = "sponti:session-change"

export type AuthUser = {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl?: string | null
  avatarPublicId?: string | null
  profileVisibility: "public" | "private"
  socialBattery: number
  createdAt: string
  updatedAt: string
}

export type Session = {
  token: string | null
  user: AuthUser | null
}

const EMPTY_SESSION: Session = { token: null, user: null }

// Cached snapshot keyed by raw localStorage contents — keeps referential
// stability for useSyncExternalStore so React doesn't loop.
let cachedRaw = ""
let cachedSnapshot: Session = EMPTY_SESSION

export function getToken(): string | null {
  return readSession().token
}

export function getUser(): AuthUser | null {
  return readSession().user
}

export function readSession(): Session {
  if (typeof window === "undefined") return EMPTY_SESSION
  const token = window.localStorage.getItem(TOKEN_KEY)
  const userRaw = window.localStorage.getItem(USER_KEY)
  const raw = `${token ?? ""}|${userRaw ?? ""}`
  if (raw === cachedRaw) return cachedSnapshot
  cachedRaw = raw
  let user: AuthUser | null = null
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as AuthUser
    } catch {
      user = null
    }
  }
  cachedSnapshot = { token, user }
  return cachedSnapshot
}

export function readServerSession(): Session {
  return EMPTY_SESSION
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function clearSession(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeSession(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}
