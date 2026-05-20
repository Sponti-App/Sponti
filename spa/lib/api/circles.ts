import { apiFetch } from "@/lib/http"
import type { Circle, CircleType } from "@/lib/circles"

type ApiUserSummary = {
  _id: string
  username: string
  displayName?: string
}

type ApiCircleMember = {
  _id: string
  circleId: string
  ownerId: string
  userId: string
  user?: ApiUserSummary | null
  createdAt?: string
}

type ApiCircle = {
  _id: string
  ownerId: string
  name: string
  color?: string | null
  type?: CircleType
  icon?: string | null
  members?: ApiCircleMember[]
}

export type CreateCircleRequest = {
  name: string
  type?: CircleType
  color?: string | null
  icon?: string | null
  memberIds?: string[]
}

export type UpdateCircleRequest = {
  name?: string
  type?: CircleType
  color?: string | null
  icon?: string | null
}

/**
 * Provides the short UI description for known system circle types. Custom or
 * missing types fall back to the default close-friends wording.
 */
function descriptionFromType(type: CircleType | undefined): string {
  if (type === "inner") return "your tightest group"
  if (type === "all") return "everyone you follow"
  if (type === "custom") return "custom circle"
  return "your closer group"
}

/**
 * Normalizes a backend circle document into the Circle shape used by frontend
 * stores and pickers, including flattening members into memberIds.
 */
export function adaptApiCircle(circle: ApiCircle): Circle {
  const type = circle.type ?? "close"
  const members = circle.members ?? []
  return {
    id: circle._id,
    name: circle.name,
    description: descriptionFromType(type),
    type,
    memberIds: members.map((member) => member.userId),
    color: circle.color ?? null,
    icon: circle.icon ?? null,
    memberAddedAt: Object.fromEntries(
      members
        .filter((member) => member.createdAt)
        .map((member) => [member.userId, member.createdAt as string])
    ),
  }
}

/**
 * Loads the signed-in user's circles for the create-event audience picker.
 */
export function fetchMyCircles(signal?: AbortSignal): Promise<Circle[]> {
  return apiFetch<{ data: ApiCircle[] }>("/circles", { signal }).then(
    (response) => response.data.map(adaptApiCircle)
  )
}

/**
 * Creates a named circle from the ad-hoc friend picker before event creation.
 */
export function createCircle(body: CreateCircleRequest): Promise<Circle> {
  return apiFetch<{ data: ApiCircle }>("/circles", {
    method: "POST",
    body,
  }).then((response) => adaptApiCircle(response.data))
}

export function updateCircle(
  circleId: string,
  body: UpdateCircleRequest
): Promise<Circle> {
  return apiFetch<{ data: ApiCircle }>(`/circles/${circleId}`, {
    method: "PATCH",
    body,
  }).then((response) => adaptApiCircle(response.data))
}

export function addCircleMember(
  circleId: string,
  userId: string
): Promise<void> {
  return apiFetch<{ data: ApiCircleMember }>(`/circles/${circleId}/members`, {
    method: "POST",
    body: { userId },
  }).then(() => undefined)
}

export function removeCircleMember(
  circleId: string,
  userId: string
): Promise<void> {
  return apiFetch<void>(`/circles/${circleId}/members/${userId}`, {
    method: "DELETE",
  })
}
