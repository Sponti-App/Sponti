import { apiFetch } from "@/lib/http"
import type { Connection, ConnectionRequest } from "@/lib/circles"

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
  type?: "qr" | "shared_invitation" | "email_invitation"
  createdAt?: string
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
    connectionId: connection._id,
    displayName: user.displayName || user.username,
    username: user.username,
  }
}

function adaptApiConnectionRequest(
  connection: ApiConnection
): ConnectionRequest | null {
  const user = adaptApiConnection(connection)
  if (!user) return null

  return {
    id: connection._id,
    user,
    createdAt: connection.createdAt ?? new Date().toISOString(),
  }
}

type FetchConnectionsParams = {
  status?: ApiConnection["status"]
  direction?: "incoming" | "outgoing" | "all"
  limit?: number
  signal?: AbortSignal
}

function fetchConnections({
  status,
  direction = "all",
  limit = 100,
  signal,
}: FetchConnectionsParams): Promise<ApiConnection[]> {
  const query = new URLSearchParams({
    direction,
    limit: String(limit),
  })
  if (status) query.set("status", status)

  return apiFetch<Paginated<ApiConnection>>(`/connections?${query}`, {
    signal,
  }).then((response) => response.data)
}

/**
 * Loads accepted friends for the custom invite picker and de-duplicates by
 * user id because the backend can return either connection direction.
 */
export function fetchAcceptedConnections(
  signal?: AbortSignal
): Promise<Connection[]> {
  return fetchConnections({
    status: "accepted",
    direction: "all",
    signal,
  }).then((connections) => {
    const byId = new Map<string, Connection>()
    for (const connection of connections) {
      const adapted = adaptApiConnection(connection)
      if (adapted) byId.set(adapted.id, adapted)
    }
    return Array.from(byId.values())
  })
}

export function fetchIncomingConnectionRequests(
  signal?: AbortSignal
): Promise<ConnectionRequest[]> {
  return fetchConnections({
    status: "pending",
    direction: "incoming",
    signal,
  }).then((connections) =>
    connections
      .map(adaptApiConnectionRequest)
      .filter((request): request is ConnectionRequest => Boolean(request))
  )
}

export function fetchOutgoingConnectionRequests(
  signal?: AbortSignal
): Promise<Connection[]> {
  return fetchConnections({
    status: "pending",
    direction: "outgoing",
    signal,
  }).then((connections) =>
    connections
      .map(adaptApiConnection)
      .filter((connection): connection is Connection => Boolean(connection))
  )
}

export function sendConnectionRequest(receiverId: string): Promise<void> {
  return apiFetch<{ data: { processed: true } }>("/connections/request", {
    method: "POST",
    body: {
      receiverId,
      type: "shared_invitation",
    },
  }).then(() => undefined)
}

export function respondToConnectionRequest(
  connectionId: string,
  status: "accepted" | "rejected"
): Promise<void> {
  return apiFetch<{ data: ApiConnection }>(
    `/connections/${connectionId}/respond`,
    {
      method: "PATCH",
      body: { status },
    }
  ).then(() => undefined)
}

export function deleteConnection(connectionId: string): Promise<void> {
  return apiFetch<void>(`/connections/${connectionId}`, {
    method: "DELETE",
  })
}
