import type { AuthUser } from "@/lib/auth-store"

const PROFILE_EXTRAS_KEY = "sponti.profile.extras.v1"

export type ProfileExtras = {
  instagram: string
  telegram: string
}

export type ProfileDraft = {
  avatarUrl: string
  displayName: string
  username: string
  email: string
  instagram: string
  telegram: string
}

export const EMPTY_PROFILE_EXTRAS: ProfileExtras = {
  instagram: "",
  telegram: "",
}

export function readProfileExtras(userId: string): ProfileExtras {
  if (typeof window === "undefined") return EMPTY_PROFILE_EXTRAS
  try {
    const raw = window.localStorage.getItem(PROFILE_EXTRAS_KEY)
    if (!raw) return EMPTY_PROFILE_EXTRAS
    const store = JSON.parse(raw) as Record<string, ProfileExtras>
    return store[userId] ?? EMPTY_PROFILE_EXTRAS
  } catch {
    return EMPTY_PROFILE_EXTRAS
  }
}

export function saveProfileExtras(userId: string, extras: ProfileExtras): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(PROFILE_EXTRAS_KEY)
    const store = raw ? (JSON.parse(raw) as Record<string, ProfileExtras>) : {}
    store[userId] = extras
    window.localStorage.setItem(PROFILE_EXTRAS_KEY, JSON.stringify(store))
  } catch {
    window.localStorage.setItem(PROFILE_EXTRAS_KEY, JSON.stringify({ [userId]: extras }))
  }
}

export function buildProfileDraft(user: Pick<AuthUser, "avatarUrl" | "displayName" | "username" | "email">, extras: ProfileExtras): ProfileDraft {
  return {
    avatarUrl: user.avatarUrl ?? "",
    displayName: user.displayName ?? "",
    username: user.username ?? "",
    email: user.email ?? "",
    instagram: extras.instagram,
    telegram: extras.telegram,
  }
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "")
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        resolve(result)
      } else {
        reject(new Error("Unable to read file"))
      }
    }
    reader.onerror = () => reject(new Error("Unable to read file"))
    reader.readAsDataURL(file)
  })
}