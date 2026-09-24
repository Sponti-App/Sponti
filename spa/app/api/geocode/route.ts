import { NextRequest, NextResponse } from "next/server"
import {
  getGoogleGeocodingApiKey,
  normalizeReverseGeocodeResponse,
  parseLatLngParams,
  reverseGeocodeUrl,
  type ReverseGeocodeResult,
} from "./googleGeocode"

// Reverse-geocodes a lat/lng into a neighbourhood/locality name for #161.
// Follows the sibling Places proxy's pattern (../places/route.ts): server-only
// key, plain fetch, and a `null` result + `error` field on failure rather
// than a bare 500, so the composer can fall back instead of looking broken.
export async function GET(req: NextRequest) {
  const coords = parseLatLngParams(req.nextUrl.searchParams)
  if (!coords) {
    return NextResponse.json(
      { area: null, locality: null, error: "lat/lng required" },
      { status: 400 }
    )
  }

  const apiKey = getGoogleGeocodingApiKey()
  if (!apiKey) {
    console.error("[geocode] GOOGLE_MAPS_API_KEY is not set")
    return NextResponse.json(
      { area: null, locality: null, error: "missing API key" },
      { status: 500 }
    )
  }

  let resp: Response
  try {
    resp = await fetch(reverseGeocodeUrl(coords, apiKey))
  } catch (err) {
    console.error("[geocode] fetch failed", err)
    return NextResponse.json(
      { area: null, locality: null, error: "fetch failed" },
      { status: 502 }
    )
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "<unreadable>")
    console.error(
      `[geocode] Google API ${resp.status} ${resp.statusText}: ${body}`
    )
    return NextResponse.json(
      { area: null, locality: null, error: "geocode unavailable" },
      { status: resp.status }
    )
  }

  let result: ReverseGeocodeResult
  try {
    result = normalizeReverseGeocodeResponse(await resp.json())
  } catch (err) {
    console.error("[geocode] malformed payload", err)
    return NextResponse.json(
      { area: null, locality: null, error: "geocode unavailable" },
      { status: 502 }
    )
  }

  return NextResponse.json(result)
}
