import { apiFetch } from "@/lib/http"

export type UserSearchResult = {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
}

type ApiUserSearchResult = {
  _id?: string
  id?: string
  username: string
  displayName?: string
  avatarUrl?: string | null
}

type UserSearchResponse =
  | { data: ApiUserSearchResult[] }
  | { users: ApiUserSearchResult[] }
  | { results: ApiUserSearchResult[] }
  | ApiUserSearchResult[]

function adaptUserSearchResult(
  user: ApiUserSearchResult
): UserSearchResult | null {
  const id = user.id ?? user._id
  if (!id) return null

  return {
    id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl ?? null,
  }
}

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const response = await apiFetch<UserSearchResponse>(
    `/api/v1/users/search?q=${encodeURIComponent(q)}`,
    { auth: true }
  )

  const users = Array.isArray(response)
    ? response
    : "data" in response
      ? (response.data ?? [])
      : "users" in response
        ? (response.users ?? [])
        : "results" in response
          ? (response.results ?? [])
          : []

  return users
    .map(adaptUserSearchResult)
    .filter((user): user is UserSearchResult => Boolean(user))
}

/**
 * How the viewer stands with a profile they opened, as the api decides it
 * (`GET /users/by-username/:username`, #199). Mirrors the QR contact flow's
 * vocabulary, plus "blocked" for someone the viewer blocked.
 */
export type ProfileRelationship =
  | "self"
  | "connected"
  | "pending_outgoing"
  | "pending_incoming"
  | "blocked"
  | "none"

export type UserProfile = {
  profile: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  relationship: ProfileRelationship
  // The pending request to cancel or accept; null otherwise.
  connectionId: string | null
}

/**
 * Someone's public identity by username. The api only ever sends display
 * name, @username and avatar, and answers 404 both for an unknown username
 * and for a user who blocked the viewer.
 */
export function fetchUserProfile(
  username: string,
  signal?: AbortSignal
): Promise<UserProfile> {
  return apiFetch<{ data: UserProfile }>(
    `/users/by-username/${encodeURIComponent(username)}`,
    { signal }
  ).then((response) => response.data)
}
