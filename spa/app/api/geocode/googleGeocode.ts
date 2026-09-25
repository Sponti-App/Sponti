// Server-side reverse-geocode helper for #161: resolves a lat/lng to a
// neighbourhood/sublocality/locality name so guests never see a host's exact
// current-location pin's street address. Mirrors the sibling Places proxy's
// pattern (server-only key, plain fetch, no SDK) — see ../places/googlePlaces.ts.

export type LatLng = { lat: number; lng: number }

export type ReverseGeocodeResult = {
  // Most specific of neighborhood -> sublocality -> locality. Never a street
  // address, route, or postal code — those Google address-component types
  // are never inspected below.
  area: string | null
  // City-level locality, kept separately for context alongside a more
  // specific `area` (e.g. "Mission District" + "San Francisco").
  locality: string | null
}

export const GEOCODING_API_BASE =
  "https://maps.googleapis.com/maps/api/geocode/json"

export function getGoogleGeocodingApiKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? ""
  )
}

/**
 * Reads required `lat`/`lng` query params. Returns null unless both are
 * present, numeric, and within valid coordinate ranges.
 */
export function parseLatLngParams(params: URLSearchParams): LatLng | null {
  const rawLat = params.get("lat")
  const rawLng = params.get("lng")
  if (!rawLat || !rawLng) return null
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function reverseGeocodeUrl(coords: LatLng, apiKey: string): string {
  const params = new URLSearchParams({
    latlng: `${coords.lat},${coords.lng}`,
    key: apiKey,
  })
  return `${GEOCODING_API_BASE}?${params}`
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Picks the most specific of neighborhood/sublocality/locality out of a
 * Geocoding API response's address_components, scanning results in the
 * order Google returns them (most specific first). Deliberately never looks
 * at `street_number`, `route`, or `postal_code` components, so a street
 * address can never surface from here even if present in the payload.
 */
export function normalizeReverseGeocodeResponse(
  data: unknown
): ReverseGeocodeResult {
  const root = record(data)
  if (!root) throw new Error("Malformed Geocoding response")

  const status = stringValue(root.status)
  if (status === "ZERO_RESULTS") return { area: null, locality: null }
  if (status !== "OK") {
    throw new Error(`Geocoding API returned status ${status ?? "unknown"}`)
  }

  const results = root.results
  if (!Array.isArray(results)) throw new Error("Malformed Geocoding results")

  let neighborhood: string | null = null
  let sublocality: string | null = null
  let locality: string | null = null

  for (const result of results) {
    const components = record(result)?.address_components
    if (!Array.isArray(components)) continue
    for (const raw of components) {
      const component = record(raw)
      if (!component) continue
      const types = Array.isArray(component.types) ? component.types : []
      const name = stringValue(component.long_name)
      if (!name) continue
      if (!neighborhood && types.includes("neighborhood")) {
        neighborhood = name
      }
      if (
        !sublocality &&
        (types.includes("sublocality") || types.includes("sublocality_level_1"))
      ) {
        sublocality = name
      }
      if (!locality && types.includes("locality")) {
        locality = name
      }
    }
  }

  return { area: neighborhood ?? sublocality ?? locality, locality }
}
