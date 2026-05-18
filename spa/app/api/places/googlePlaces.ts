export const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1"

export function getGooglePlacesApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY ?? ""
}

export function upstreamFailureStatus(status: number): number {
  return status === 429 ? 429 : 502
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function readLocalizedText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (!isRecord(value)) return ""
  return readString(value.text)
}
