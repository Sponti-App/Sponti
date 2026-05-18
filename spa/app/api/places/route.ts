import { NextRequest, NextResponse } from "next/server"
import {
  GOOGLE_PLACES_BASE_URL,
  getGooglePlacesApiKey,
  isRecord,
  readLocalizedText,
  readString,
  upstreamFailureStatus,
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
      { suggestions: [], error: "Place search is not configured" },
      { status: 500 },
    )
  }

  let resp: Response
  try {
    resp = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
      },
      body: JSON.stringify({ input: input.trim() }),
    })
  } catch (err) {
    console.error("[places] fetch failed", err)
    return NextResponse.json(
      { suggestions: [], error: "Place search is unavailable" },
      { status: 502 },
    )
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "<unreadable>")
    console.error(
      `[places] Google API ${resp.status} ${resp.statusText}: ${body}`,
    )
    return NextResponse.json(
      { suggestions: [], error: "Place search is unavailable" },
      { status: upstreamFailureStatus(resp.status) },
    )
  }

  type Prediction = {
    placePrediction?: {
      placeId?: string
      text?: { text?: string }
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
    }
  }

  const data = (await resp.json().catch(() => null)) as {
    suggestions?: Prediction[]
  } | null
  const rawSuggestions = Array.isArray(data?.suggestions)
    ? data.suggestions
    : []
  const suggestions = rawSuggestions
    .slice(0, 5)
    .map((s) => {
      const prediction = isRecord(s.placePrediction)
        ? s.placePrediction
        : null
      return {
        placeId: readString(prediction?.placeId),
        label:
          readLocalizedText(
            isRecord(prediction?.structuredFormat)
              ? prediction.structuredFormat.mainText
              : null,
          ) || readLocalizedText(prediction?.text),
        address: readLocalizedText(
          isRecord(prediction?.structuredFormat)
            ? prediction.structuredFormat.secondaryText
            : null,
        ),
      }
    })
    .filter((s) => s.placeId && s.label)

  return NextResponse.json({ suggestions })
}
