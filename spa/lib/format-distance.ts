// The one place a distance becomes a label. The app is kilometres-only (no
// locale switch, no setting), so every distance shown to a user goes through
// `formatDistance`. Copy is lowercase per BRAND.md.
//
//   < 1 km   -> metres, rounded to 10 m      "850 m"
//   1-10 km  -> one decimal                  "1.2 km"
//   10 km+   -> whole km                     "14 km"
//
// Rounding is done before choosing the band so a value never renders as
// "1000 m" or "10.0 km".

export function formatDistance(meters: number): string {
  const m = Number.isFinite(meters) ? Math.max(0, meters) : 0

  const roundedMetres = Math.round(m / 10) * 10
  if (roundedMetres < 1000) {
    // Never claim "0 m" for a distance that is non-zero.
    return `${m > 0 ? Math.max(10, roundedMetres) : 0} m`
  }

  // Work in tenths of a km (integer maths on metres avoids 9.95 * 10 float drift).
  const tenthsOfKm = Math.round(m / 100)
  if (tenthsOfKm < 100) return `${(tenthsOfKm / 10).toFixed(1)} km`

  return `${Math.round(m / 1000)} km`
}
