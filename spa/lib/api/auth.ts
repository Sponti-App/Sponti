import { authFetch } from "../http"
import type { AuthUser } from "../auth-store"

type AuthResponse = {
  accessToken: string
  user: AuthUser
}

export type RegisterPayload = {
  username: string
  displayName: string
  email: string
  password: string
}

export type LoginPayload = {
  email: string
  password: string
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/auth/register", { method: "POST", body: payload })
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/auth/login", { method: "POST", body: payload })
}

export function logout(): Promise<void> {
  return authFetch<void>("/auth/logout", { method: "POST" })
}

export function me(): Promise<{ user: AuthUser }> {
  return authFetch<{ user: AuthUser }>("/auth/me", { auth: true })
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return authFetch<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } })
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return authFetch<{ message: string }>("/auth/reset-password", { method: "POST", body: { token, password } })
}
