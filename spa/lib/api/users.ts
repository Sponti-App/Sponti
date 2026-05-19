import { apiFetch } from "@/lib/http"

export type UserSearchResult = {
    id: string
    username: string
    displayName: string
    avatarUrl?: string | null
}

type UserSearchResponse =
    | { data: UserSearchResult[] }
    | { users: UserSearchResult[] }
    | { results: UserSearchResult[] }
    | UserSearchResult[]

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
    const response = await apiFetch<UserSearchResponse>(
        `/api/v1/users/search?q=${encodeURIComponent(q)}`,
        { auth: true },
    )

    if (Array.isArray(response)) return response
    if ("data" in response) return response.data ?? []
    if ("users" in response) return response.users ?? []
    if ("results" in response) return response.results ?? []

    return []
}