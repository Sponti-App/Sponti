import type { EventType } from "@/lib/api/events"
import type { GeoCoords } from "@/lib/geolocation"
import { apiFetch } from "@/lib/http"
import { EVENT_TYPES } from "@/types/utils"

// #389: the open-to-all flares a signed-out visitor sees on the map, from the
// one unauthenticated read of flare data (#425,
// `GET /api/v1/public/events/map`). The api returns pins only: id, category,
// position, start and end. There is no title, host, place name or going
// count, and nothing here may ask for one. See "Signed-out visitors" in
// api/CONTEXT.md.

/** One pin, exactly as the api sends it. */
export type ApiPublicMapPin = {
  _id: string
  type: EventType
  location: { type: "Point"; coordinates: [number, number] }
  startAt: string
  endAt: string
}

export type PublicMapPinsResponse = { data: ApiPublicMapPin[] }

/** A pin as the signed-out map draws it. Always open to all. */
export type PublicMapPin = {
  id: string
  type: EventType
  visibility: "public"
  startAt: string
  endAt: string
  position: GeoCoords
}

/** The api's own default and cap are 25 and 100 km. */
export const PUBLIC_MAP_DEFAULT_RADIUS_KM = 25

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
}

/**
 * The pin the map draws, or null for one it can't place: a missing id, an
 * unknown category, coordinates out of range, or unreadable times.
 */
export function adaptPublicMapPin(raw: unknown): PublicMapPin | null {
  if (!raw || typeof raw !== "object") return null
  const pin = raw as Partial<Record<keyof ApiPublicMapPin, unknown>>
  if (typeof pin._id !== "string" || !pin._id) return null
  if (!EVENT_TYPES.some((t) => t.value === pin.type)) return null
  if (!isDate(pin.startAt) || !isDate(pin.endAt)) return null
  const coordinates = (pin.location as { coordinates?: unknown } | undefined)
    ?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null
  const [lng, lat] = coordinates as unknown[]
  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) return null
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null
  return {
    id: pin._id,
    type: pin.type as EventType,
    visibility: "public",
    startAt: pin.startAt,
    endAt: pin.endAt,
    position: { lat, lng },
  }
}

/**
 * Open-to-all flares around `center`. Sent without a token (`auth: false`),
 * so a signed-out visitor never triggers a session refresh or a 401.
 */
export async function fetchPublicMapPins(
  center: GeoCoords,
  radiusKm: number = PUBLIC_MAP_DEFAULT_RADIUS_KM,
  signal?: AbortSignal
): Promise<PublicMapPin[]> {
  const params = new URLSearchParams({
    lng: String(center.lng),
    lat: String(center.lat),
    radiusKm: String(radiusKm),
  })
  const response = await apiFetch<PublicMapPinsResponse>(
    `/public/events/map?${params}`,
    { auth: false, signal }
  )
  const data: unknown[] = Array.isArray(response?.data) ? response.data : []
  return data.flatMap((raw) => {
    const pin = adaptPublicMapPin(raw)
    return pin ? [pin] : []
  })
}
