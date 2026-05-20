import { apiFetch } from "@/lib/http"
import type { BlockedUser } from "@/lib/circles"

type ApiUserSummary = {
  _id: string
  username: string
  displayName?: string
}

type ApiBlock = {
  _id: string
  blockedId: string
  createdAt?: string
  blockedUser?: ApiUserSummary | null
}

function adaptApiBlock(block: ApiBlock): BlockedUser | null {
  const user = block.blockedUser
  if (!user) return null

  return {
    id: user._id,
    displayName: user.displayName || user.username,
    username: user.username,
    blockedAt: block.createdAt ?? new Date().toISOString(),
  }
}

export function fetchBlockedUsers(signal?: AbortSignal): Promise<BlockedUser[]> {
  return apiFetch<{ data: ApiBlock[] }>("/blocks", { signal }).then(
    (response) =>
      response.data
        .map(adaptApiBlock)
        .filter((block): block is BlockedUser => Boolean(block))
  )
}

export function blockUser(userId: string): Promise<void> {
  return apiFetch<{ data: ApiBlock }>(`/blocks/${userId}`, {
    method: "POST",
  }).then(() => undefined)
}

export function unblockUser(userId: string): Promise<void> {
  return apiFetch<void>(`/blocks/${userId}`, {
    method: "DELETE",
  })
}
