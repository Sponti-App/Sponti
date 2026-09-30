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

/** Who someone is: what every signed-in viewer who isn't blocked gets. */
export type ProfileIdentity = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export type ProfileSocials = {
  instagram: string | null
  telegram: string | null
}

export type MutualFriends = {
  count: number
  // The first few, in name order; the full list is `fetchMutualFriends`.
  preview: ProfileIdentity[]
}

export type UserProfile = {
  profile: ProfileIdentity & {
    // null wherever the viewer may not see it or the owner left it empty:
    // the api answers both the same way, so neither does the page tell them
    // apart (#288).
    bio: string | null
    socials: ProfileSocials
  }
  relationship: ProfileRelationship
  // The pending request to cancel or accept; null otherwise.
  connectionId: string | null
  mutualFriends: MutualFriends
}

type ApiUserProfile = Omit<UserProfile, "profile" | "mutualFriends"> & {
  profile: Partial<UserProfile["profile"]> & ProfileIdentity
  mutualFriends?: Partial<MutualFriends> | null
}

// Optional fields a server may leave out read as "empty", so the page never
// has to guard for them.
function adaptUserProfile(raw: ApiUserProfile): UserProfile {
  return {
    ...raw,
    profile: {
      ...raw.profile,
      bio: raw.profile.bio?.trim() ? raw.profile.bio : null,
      socials: {
        instagram: raw.profile.socials?.instagram || null,
        telegram: raw.profile.socials?.telegram || null,
      },
    },
    mutualFriends: {
      count: raw.mutualFriends?.count ?? 0,
      preview: raw.mutualFriends?.preview ?? [],
    },
  }
}

/**
 * Someone's profile by username (`GET /users/by-username/:username`, #199,
 * #288). What comes back depends on who is looking; anything the viewer may
 * not see is empty (null bio and handles, no mutual friends), and the api
 * answers 404 both for an unknown username and for a user who blocked the
 * viewer.
 */
export function fetchUserProfile(
  username: string,
  signal?: AbortSignal
): Promise<UserProfile> {
  return apiFetch<{ data: ApiUserProfile }>(
    `/users/by-username/${encodeURIComponent(username)}`,
    { signal }
  ).then((response) => adaptUserProfile(response.data))
}

export type MutualFriendsPage = {
  people: ProfileIdentity[]
  hasMore: boolean
}

/**
 * The full mutual friends list behind the count, a page at a time, in name
 * order (`GET /users/by-username/:username/mutual-friends`).
 */
export function fetchMutualFriends(
  username: string,
  page: number,
  signal?: AbortSignal
): Promise<MutualFriendsPage> {
  return apiFetch<{
    data: ProfileIdentity[]
    pagination?: { page: number; totalPages: number }
  }>(
    `/users/by-username/${encodeURIComponent(username)}/mutual-friends?page=${page}&limit=20`,
    { signal }
  ).then((response) => ({
    people: response.data ?? [],
    hasMore: (response.pagination?.totalPages ?? 0) > page,
  }))
}
