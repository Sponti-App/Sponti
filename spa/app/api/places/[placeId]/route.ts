/**
 * Creates real HTTP endpoints
 */

import { NextRequest, NextResponse } from "next/server"
import {
  GOOGLE_PLACES_BASE_URL,
  getGooglePlacesApiKey,
  isRecord,
  readLocalizedText,
  readNumber,
  readString,
  upstreamFailureStatus,
} from "../googlePlaces"

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  const { placeId: rawPlaceId } = await params
  const placeId = readString(rawPlaceId)

  if (!placeId) {
    return NextResponse.json({ error: "Missing placeId" }, { status: 400 })
  }

  if (!PLACE_ID_PATTERN.test(placeId)) {
    return NextResponse.json({ error: "Invalid placeId" }, { status: 400 })
  }

  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) {
    console.error("[places/details] GOOGLE_MAPS_API_KEY is not set")
    return NextResponse.json(
      { error: "Place lookup is not configured" },
      { status: 500 }
    )
  }

  let resp: Response
  try {
    resp = await fetch(
      `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
        },
      }
    )
  } catch (err) {
    console.error("[places/details] fetch failed", err)
    return NextResponse.json(
      { error: "Place lookup is unavailable" },
      { status: 502 }
    )
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "<unreadable>")
    console.error(
      `[places/details] Google API ${resp.status} ${resp.statusText}: ${body}`
    )
    return NextResponse.json(
      { error: "Place lookup is unavailable" },
      { status: upstreamFailureStatus(resp.status) }
    )
  }

  const data = await resp.json().catch(() => null)
  if (!isRecord(data)) {
    return NextResponse.json(
      { error: "Place lookup returned an invalid response" },
      { status: 502 }
    )
  }

  const id = readString(data.id) || placeId
  const address = readString(data.formattedAddress) || null
  const name = readLocalizedText(data.displayName) || address
  const location = isRecord(data.location) ? data.location : null
  const lat = readNumber(location?.latitude)
  const lng = readNumber(location?.longitude)

  if (!name || lat === null || lng === null) {
    return NextResponse.json(
      { error: "Place lookup returned incomplete location data" },
      { status: 502 }
    )
  }

  return NextResponse.json({
    placeId: id,
    name,
    address,
    lat,
    lng,
  })
}
