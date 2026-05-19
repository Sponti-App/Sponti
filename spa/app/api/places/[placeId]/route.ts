import { NextRequest, NextResponse } from "next/server"
import {
  PLACE_DETAILS_FIELD_MASK,
  PLACES_API_BASE,
  getGooglePlacesApiKey,
  normalizePlaceDetailsResponse,
  normalizePlaceId,
} from "../googlePlaces"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ placeId?: string }> }
) {
  const { placeId: rawPlaceId } = await params
  const placeId = normalizePlaceId(rawPlaceId)

  if (!placeId) {
    return NextResponse.json(
      { error: "A valid placeId is required." },
      { status: 400 }
    )
  }

  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) {
    console.error("[places] GOOGLE_MAPS_API_KEY is not set")
    return NextResponse.json({ error: "missing API key" }, { status: 500 })
  }

  let resp: Response
  try {
    resp = await fetch(
      `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
        },
      }
    )
  } catch (err) {
    console.error("[places] details fetch failed", err)
    return NextResponse.json(
      { error: "Place details unavailable." },
      { status: 502 }
    )
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "<unreadable>")
    console.error(
      `[places] Details API ${resp.status} ${resp.statusText}: ${body}`
    )
    return NextResponse.json(
      { error: "Place details unavailable." },
      { status: resp.status }
    )
  }

  try {
    const place = normalizePlaceDetailsResponse(await resp.json(), placeId)
    if (!place) {
      return NextResponse.json(
        { error: "Place is missing location coordinates." },
        { status: 502 }
      )
    }

    return NextResponse.json(place)
  } catch (err) {
    console.error("[places] malformed details payload", err)
    return NextResponse.json(
      { error: "Place details unavailable." },
      { status: 502 }
    )
  }
}
