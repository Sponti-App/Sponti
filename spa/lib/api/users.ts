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
