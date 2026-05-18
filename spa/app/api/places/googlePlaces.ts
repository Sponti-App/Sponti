export type PlaceSuggestion = {
  placeId: string
  label: string
  address: string
}

export type PlaceDetails = {
  placeId: string
  name: string
  address: string | null
  lat: number
  lng: number
}

export const PLACES_API_BASE = "https://places.googleapis.com/v1"
export const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text"
export const PLACE_DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location"

export function getGooglePlacesApiKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? ""
  )
}

export function normalizePlaceId(
  value: string | null | undefined
): string | null {
  const placeId = value?.trim()
  if (!placeId || placeId.length > 256) return null
  if (placeId.includes("/") || placeId.includes("\\")) return null
  return placeId
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formattableText(value: unknown): string | null {
  return stringValue(record(value)?.text)
}

export function normalizeAutocompleteResponse(
  data: unknown
): PlaceSuggestion[] {
  const root = record(data)
  if (!root) throw new Error("Malformed Places autocomplete response")

  const rawSuggestions = root.suggestions
  if (rawSuggestions === undefined) return []
  if (!Array.isArray(rawSuggestions)) {
    throw new Error("Malformed Places autocomplete suggestions")
  }

  return rawSuggestions
    .slice(0, 5)
    .map((item): PlaceSuggestion | null => {
      const prediction = record(record(item)?.placePrediction)
      if (!prediction) return null

      const placeId = stringValue(prediction.placeId)
      if (!placeId) return null

      const structuredFormat = record(prediction.structuredFormat)
      const label =
        formattableText(structuredFormat?.mainText) ??
        formattableText(prediction.text)
      if (!label) return null

      const address = formattableText(structuredFormat?.secondaryText) ?? ""
      return { placeId, label, address }
    })
    .filter((suggestion): suggestion is PlaceSuggestion => suggestion !== null)
}

export function normalizePlaceDetailsResponse(
  data: unknown,
  requestedPlaceId: string
): PlaceDetails | null {
  const root = record(data)
  if (!root) throw new Error("Malformed Place Details response")

  const placeId = stringValue(root.id) ?? requestedPlaceId
  const displayName = record(root.displayName)
  const name = stringValue(displayName?.text)
  const address = stringValue(root.formattedAddress)
  const location = record(root.location)
  const lat = numberValue(location?.latitude)
  const lng = numberValue(location?.longitude)

  if (!name || lat === null || lng === null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return {
    placeId,
    name,
    address,
    lat,
    lng,
  }
}
