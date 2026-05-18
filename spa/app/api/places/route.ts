import { NextRequest, NextResponse } from "next/server"
import {
  AUTOCOMPLETE_FIELD_MASK,
  PLACES_API_BASE,
  getGooglePlacesApiKey,
  normalizeAutocompleteResponse,
} from "./googlePlaces"

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input") ?? ""
  if (input.trim().length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) {
    console.error("[places] GOOGLE_MAPS_API_KEY is not set")
    return NextResponse.json(
      { suggestions: [], error: "missing API key" },
      { status: 500 }
    )
  }

  let resp: Response
  try {
    resp = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
      },
      body: JSON.stringify({ input: input.trim() }),
    })
  } catch (err) {
    console.error("[places] fetch failed", err)
    return NextResponse.json(
      { suggestions: [], error: "fetch failed" },
      { status: 502 }
    )
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "<unreadable>")
    console.error(
      `[places] Google API ${resp.status} ${resp.statusText}: ${body}`
    )
    return NextResponse.json(
      { suggestions: [], error: "places unavailable" },
      { status: resp.status }
    )
  }

  let suggestions
  try {
    suggestions = normalizeAutocompleteResponse(await resp.json())
  } catch (err) {
    console.error("[places] malformed autocomplete payload", err)
    return NextResponse.json(
      { suggestions: [], error: "places unavailable" },
      { status: 502 }
    )
  }

  return NextResponse.json({ suggestions })
}
