import { NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input") ?? ""
  if (input.trim().length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  let data: Record<string, unknown>
  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
      },
      body: JSON.stringify({ input: input.trim() }),
    })
    if (!resp.ok) return NextResponse.json({ suggestions: [] })
    data = await resp.json()
  } catch {
    return NextResponse.json({ suggestions: [] })
  }

  type Prediction = {
    placePrediction?: {
      text?: { text?: string }
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
    }
  }

  const suggestions = ((data.suggestions as Prediction[] | undefined) ?? [])
    .slice(0, 5)
    .map((s) => ({
      label:
        s.placePrediction?.structuredFormat?.mainText?.text ??
        s.placePrediction?.text?.text ??
        "",
      address: s.placePrediction?.structuredFormat?.secondaryText?.text ?? "",
    }))
    .filter((s) => s.label)

  return NextResponse.json({ suggestions })
}
