import { apiFetch } from "@/lib/http"
import type { Connection } from "@/lib/circles"

type ApiUserSummary = {
  _id: string
  username: string
  displayName?: string
}

type ApiConnection = {
  _id: string
  requesterId: string
  receiverId: string
  status: "pending" | "accepted" | "rejected"
  otherUser?: ApiUserSummary | null
}

type Paginated<T> = {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

function adaptApiConnection(connection: ApiConnection): Connection | null {
  const user = connection.otherUser
  if (!user) return null
  return {
    id: user._id,
    displayName: user.displayName || user.username,
    username: user.username,
  }
}

export function fetchAcceptedConnections(
  signal?: AbortSignal
): Promise<Connection[]> {
  return apiFetch<Paginated<ApiConnection>>(
    "/connections?status=accepted&direction=all&limit=100",
    { signal }
  ).then((response) => {
    const byId = new Map<string, Connection>()
    for (const connection of response.data) {
      const adapted = adaptApiConnection(connection)
      if (adapted) byId.set(adapted.id, adapted)
    }
    return Array.from(byId.values())
  })
}
