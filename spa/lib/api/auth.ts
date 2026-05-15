import { authFetch } from "../http"
import type { AuthUser } from "../auth-store"

type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: AuthUser
  isNewUser?: boolean
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

export type RefreshPayload = {
  refreshToken: string
}
export type UpdateProfilePayload = {
  displayName?: string
  username?: string
  email?: string
  profileVisibility?: "public" | "private"
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: payload,
  })
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  })
}

export function googleLogin(credential: string): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/auth/google", {
    method: "POST",
    body: { credential },
  })
}

export function refresh(
  payload: RefreshPayload
): Promise<Pick<AuthResponse, "accessToken" | "refreshToken">> {
  return authFetch<Pick<AuthResponse, "accessToken" | "refreshToken">>(
    "/auth/refresh",
    {
      method: "POST",
      body: payload,
    }
  )
}

export function logout(refreshToken: string): Promise<{ success: true }> {
  return authFetch<{ success: true }>("/auth/logout", {
    method: "POST",
    auth: true,
    body: { refreshToken },
  })
}

export function me(): Promise<{ user: AuthUser }> {
  return authFetch<{ user: AuthUser }>("/auth/me", { auth: true })
}

export function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData()
  formData.append("avatar", file)
  return authFetch<{ avatarUrl: string }>("/auth/me/avatar", {
    method: "PATCH",
    auth: true,
    formData: true,
    body: formData,
  })
}
export function updateProfile(
  payload: UpdateProfilePayload
): Promise<{ user: AuthUser }> {
  return authFetch<{ user: AuthUser }>("/auth/me/profile", {
    method: "PATCH",
    auth: true,
    body: payload,
  })
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return authFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  })
}

export function resetPassword(
  token: string,
  password: string
): Promise<{ message: string }> {
  return authFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: { token, password },
  })
}
