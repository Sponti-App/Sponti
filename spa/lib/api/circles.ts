import { apiFetch } from "@/lib/http"
import type { Circle, CircleTier, CircleType } from "@/lib/circles"

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

/**
 * Converts the backend circle type into the visual tier used by the frontend
 * circle stack icon and audience picker ordering.
 */
function tierFromType(type: CircleType | undefined): CircleTier {
  if (type === "inner") return 1
  if (type === "all") return 3
  return 2
}

/**
 * Provides the short UI description for known system circle types. Custom or
 * missing types fall back to the default close-friends wording.
 */
function descriptionFromType(type: CircleType | undefined): string {
  if (type === "inner") return "your tightest group"
  if (type === "all") return "everyone you follow"
  return "your closer group"
}

/**
 * Normalizes a backend circle document into the Circle shape used by frontend
 * stores and pickers, including flattening members into memberIds.
 */
export function adaptApiCircle(circle: ApiCircle): Circle {
  const type = circle.type ?? "close"
  return {
    id: circle._id,
    name: circle.name,
    description: descriptionFromType(type),
    tier: tierFromType(type),
    type,
    color: circle.color ?? null,
    icon: circle.icon ?? null,
    memberIds: (circle.members ?? []).map((member) => member.userId),
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
