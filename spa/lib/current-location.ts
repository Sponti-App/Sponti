// Guests never see a street address for a flare posted at the host's current
// location (#161 decision) — only the neighbourhood, or a coarser fallback
// within about 1km. This module holds the shared fallback chain used both by
// the composer (to resolve a label before posting) and by the event display
// surfaces (to reinterpret flares that were already stored with the old
// literal "Current location" name, which is never backfilled).

/** Shown when nothing usable is known about a current-location flare's area:
 * the reverse-geocode lookup failed, timed out, the key is missing, or the
 * legacy literal name is all we have. */
export const CURRENT_LOCATION_FALLBACK_LABEL = "near the host"

const LEGACY_CURRENT_LOCATION_NAME = "current location"

/** True for the pre-#161 literal name stored by the composer before this fix.
 * Existing flares are not backfilled, so display surfaces map this name to
 * the neutral fallback instead. */
export function isLegacyCurrentLocationName(name: string): boolean {
  return name.trim().toLowerCase() === LEGACY_CURRENT_LOCATION_NAME
}

/** Maps a stored location name to what guests (and the host) should see.
 * Only rewrites the legacy literal; every other name — including the
 * neighbourhood/coarse labels this fix now stores going forward — passes
 * through unchanged. */
export function displayLocationName(name: string): string {
  return isLegacyCurrentLocationName(name) ? CURRENT_LOCATION_FALLBACK_LABEL : name
}

/** The shape the reverse-geocode API route resolves to: `area` is the most
 * specific of neighborhood/sublocality/locality Google has, `locality` is
 * the city-level name for context. Both null when nothing came back. */
export type ReverseGeocodeArea = {
  area: string | null
  locality: string | null
}

/**
 * Resolves the label + address a host's current-location flare gets before
 * posting, from most to least specific. Never a street address (#161):
 * - neighbourhood/sublocality known → that area, with the locality as
 *   supporting `address` (or null if even that is unknown).
 * - only a locality known (no finer area, or the finer area happens to equal
 *   it) → a coarse "within 1 km of <locality>" label.
 * - nothing known (lookup failed, timed out, or the server key is missing)
 *   → a neutral label so no location context leaks at all.
 */
export function resolveCurrentLocationLabel(
  geocode: ReverseGeocodeArea | null
): { name: string; address: string | null } {
  const area = geocode?.area?.trim() || null
  const locality = geocode?.locality?.trim() || null

  if (area && area !== locality) {
    return { name: area, address: locality }
  }
  if (locality) {
    return { name: `within 1 km of ${locality}`, address: null }
  }
  return { name: CURRENT_LOCATION_FALLBACK_LABEL, address: null }
}
