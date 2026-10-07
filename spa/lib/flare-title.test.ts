import { describe, expect, it } from "vitest"

import type { EventType } from "@/lib/api/events"
import {
  CATEGORY_PHRASE,
  composeFlareTitle,
  displayFlareTitle,
  eventDisplayTitle,
  hostFirstName,
  isGeneratedFlareTitle,
  parseLegacyTitle,
} from "@/lib/flare-title"

const TYPES = Object.keys(CATEGORY_PHRASE) as EventType[]

describe("composeFlareTitle", () => {
  it("has a short lowercase phrase for every category", () => {
    for (const type of TYPES) {
      const title = composeFlareTitle({ type })
      expect(title).toBe(CATEGORY_PHRASE[type])
      expect(title).toBe(title.toLowerCase())
      expect(title.length).toBeLessThanOrEqual(20)
    }
  })

  it("never writes a type label, date, time, separator or host", () => {
    for (const type of TYPES) {
      const title = composeFlareTitle({
        type,
        placeType: "performing_arts_theater",
        placeName: "ACUD Theater",
      })
      expect(title).not.toContain("·")
      expect(title).not.toMatch(/\d/)
      expect(title).not.toContain(" with ")
    }
  })

  it("uses the place's type when it says more than a loose category", () => {
    expect(
      composeFlareTitle({
        type: "hobby",
        placeType: "performing_arts_theater",
        placeName: "ACUD Theater",
      })
    ).toBe("theater outing")
    expect(composeFlareTitle({ type: "hangout", placeType: "cafe" })).toBe(
      "coffee"
    )
    expect(composeFlareTitle({ type: "hangout", placeType: "park" })).toBe(
      "park hangout"
    )
  })

  it("uses the place's type when it belongs to the picked category", () => {
    expect(composeFlareTitle({ type: "culture", placeType: "museum" })).toBe(
      "museum visit"
    )
    expect(
      composeFlareTitle({ type: "culture", placeType: "movie_theater" })
    ).toBe("cinema outing")
    expect(
      composeFlareTitle({ type: "culture", placeType: "art_gallery" })
    ).toBe("gallery visit")
    expect(composeFlareTitle({ type: "drinks", placeType: "wine_bar" })).toBe(
      "drinks"
    )
    expect(composeFlareTitle({ type: "food", placeType: "coffee_shop" })).toBe(
      "coffee"
    )
    expect(composeFlareTitle({ type: "party", placeType: "night_club" })).toBe(
      "club night"
    )
    expect(composeFlareTitle({ type: "sports", placeType: "gym" })).toBe(
      "workout"
    )
  })

  it("keeps a specific category the place contradicts", () => {
    expect(composeFlareTitle({ type: "sports", placeType: "bar" })).toBe(
      "sports session"
    )
    expect(composeFlareTitle({ type: "culture", placeType: "pub" })).toBe(
      "culture outing"
    )
    expect(composeFlareTitle({ type: "party", placeType: "museum" })).toBe(
      "party"
    )
  })

  it("falls back to the place's name when no type came with it", () => {
    expect(
      composeFlareTitle({ type: "hobby", placeName: "ACUD Theater" })
    ).toBe("theater outing")
    expect(
      composeFlareTitle({ type: "hangout", placeName: "Volksbühne" })
    ).toBe("theater outing")
    expect(
      composeFlareTitle({ type: "hangout", placeName: "Babylon Kino" })
    ).toBe("cinema outing")
    expect(
      composeFlareTitle({ type: "hangout", placeName: "Café Einstein" })
    ).toBe("coffee")
    expect(
      composeFlareTitle({ type: "hangout", placeName: "Tiergarten Park" })
    ).toBe("park hangout")
    expect(
      composeFlareTitle({ type: "culture", placeName: "Neue Nationalgalerie" })
    ).toBe("culture outing")
  })

  it("lets a recognised type win over a misleading name", () => {
    expect(
      composeFlareTitle({
        type: "hangout",
        placeType: "museum",
        placeName: "The Bar Next Door",
      })
    ).toBe("museum visit")
  })

  it("does not match a kind inside a longer word", () => {
    expect(
      composeFlareTitle({ type: "hangout", placeName: "Barbarossa" })
    ).toBe("hangout")
    expect(composeFlareTitle({ type: "hangout", placeName: "Mauerpark" })).toBe(
      "hangout"
    )
  })

  it("ignores an unknown or empty place", () => {
    expect(composeFlareTitle({ type: "food", placeType: "atm" })).toBe(
      "bite to eat"
    )
    expect(
      composeFlareTitle({ type: "food", placeType: "  ", placeName: " " })
    ).toBe("bite to eat")
    expect(
      composeFlareTitle({ type: "food", placeType: null, placeName: null })
    ).toBe("bite to eat")
    expect(composeFlareTitle({ type: "food", placeName: "my location" })).toBe(
      "bite to eat"
    )
  })

  it("reads the place type case-insensitively", () => {
    expect(
      composeFlareTitle({
        type: "hangout",
        placeType: "Performing_Arts_Theater",
      })
    ).toBe("theater outing")
  })

  it("falls back to the hangout phrase for a type it does not know", () => {
    expect(composeFlareTitle({ type: "mystery" as EventType })).toBe("hangout")
  })
})

describe("hostFirstName", () => {
  it("takes the first word, lowercased", () => {
    expect(hostFirstName("Lukas Hanus")).toBe("lukas")
    expect(hostFirstName("  Anna-Lena  Meyer ")).toBe("anna-lena")
    expect(hostFirstName("sam")).toBe("sam")
  })

  it("returns null for a missing name or a placeholder", () => {
    expect(hostFirstName(null)).toBeNull()
    expect(hostFirstName(undefined)).toBeNull()
    expect(hostFirstName("")).toBeNull()
    expect(hostFirstName("   ")).toBeNull()
    expect(hostFirstName("you")).toBeNull()
    expect(hostFirstName("Host")).toBeNull()
  })
})

describe("isGeneratedFlareTitle", () => {
  it("knows every category phrase and place phrase", () => {
    for (const type of TYPES) {
      expect(isGeneratedFlareTitle(CATEGORY_PHRASE[type])).toBe(true)
    }
    expect(isGeneratedFlareTitle("theater outing")).toBe(true)
    expect(isGeneratedFlareTitle("  Coffee ")).toBe(true)
  })

  it("is false for anything else", () => {
    expect(isGeneratedFlareTitle("rooftop drinks")).toBe(false)
    expect(isGeneratedFlareTitle("theater outing with lukas")).toBe(false)
    expect(isGeneratedFlareTitle("")).toBe(false)
  })
})

describe("parseLegacyTitle", () => {
  it("reads the old four-part title", () => {
    expect(
      parseLegacyTitle(
        "hobby · lukas hanus · acud theater · mi 7:45pm",
        "hobby"
      )
    ).toEqual({ type: "hobby", host: "lukas hanus", place: "acud theater" })
  })

  it("reads the old three-part title that had no place", () => {
    expect(parseLegacyTitle("drinks · sam · in 30m", "drinks")).toEqual({
      type: "drinks",
      host: "sam",
      place: null,
    })
  })

  it("takes the type from the title when the caller has none", () => {
    expect(parseLegacyTitle("food · sam · in 30m")).toEqual({
      type: "food",
      host: "sam",
      place: null,
    })
    expect(parseLegacyTitle("rooftop · sam · in 30m")).toBeNull()
    expect(parseLegacyTitle("toString · sam · in 30m")).toBeNull()
  })

  it("leaves other titles alone", () => {
    expect(parseLegacyTitle("rooftop drinks", "drinks")).toBeNull()
    expect(parseLegacyTitle("drinks · sam", "drinks")).toBeNull()
    expect(
      parseLegacyTitle("hobby · lukas · acud theater · mi 7:45pm", "drinks")
    ).toBeNull()
    expect(parseLegacyTitle("a · b · c · d · e", "hobby")).toBeNull()
    expect(parseLegacyTitle("hobby ·  · mi 7:45pm", "hobby")).toBeNull()
  })
})

describe("displayFlareTitle", () => {
  const base = { type: "hobby" as EventType, hostName: "Lukas Hanus" }

  it("adds the host's first name to a composed title for other viewers", () => {
    expect(
      displayFlareTitle({ ...base, title: "theater outing", isHost: false })
    ).toBe("theater outing with lukas")
  })

  it("leaves the host's own flare without their name", () => {
    expect(
      displayFlareTitle({ ...base, title: "theater outing", isHost: true })
    ).toBe("theater outing")
  })

  it("does not add a name when the host is unknown", () => {
    expect(
      displayFlareTitle({
        type: "drinks",
        title: "drinks",
        hostName: "host",
        isHost: false,
      })
    ).toBe("drinks")
    expect(
      displayFlareTitle({ type: "drinks", title: "drinks", isHost: false })
    ).toBe("drinks")
  })

  it("keeps a title the host wrote", () => {
    expect(
      displayFlareTitle({ ...base, title: "rooftop vibes", isHost: false })
    ).toBe("rooftop vibes")
    expect(
      displayFlareTitle({
        ...base,
        title: "dinner with the old team",
        isHost: false,
      })
    ).toBe("dinner with the old team")
  })

  it("shows an old joined title as a phrase, with the name for others", () => {
    const title = "hobby · lukas hanus · acud theater · mi 7:45pm"
    expect(displayFlareTitle({ ...base, title, isHost: false })).toBe(
      "theater outing with lukas"
    )
    expect(displayFlareTitle({ ...base, title, isHost: true })).toBe(
      "theater outing"
    )
  })

  it("reads the host from an old title when the api sent none", () => {
    expect(
      displayFlareTitle({
        type: "drinks",
        title: "drinks · Sam Smith · in 30m",
        isHost: false,
      })
    ).toBe("drinks with sam")
  })

  it("reads an old title on a surface that has no type", () => {
    expect(
      displayFlareTitle({
        title: "hobby · lukas hanus · acud theater · mi 7:45pm",
        isHost: true,
      })
    ).toBe("theater outing")
  })

  it("trims stray whitespace", () => {
    expect(
      displayFlareTitle({ ...base, title: "  rooftop vibes ", isHost: true })
    ).toBe("rooftop vibes")
  })
})

describe("eventDisplayTitle", () => {
  const event = {
    title: "bite to eat",
    type: "food" as EventType,
    host: { id: "host-1", name: "Mara Klein" },
  }

  it("treats a viewer who is not the host as a guest", () => {
    expect(eventDisplayTitle(event, "guest-9")).toBe("bite to eat with mara")
    expect(eventDisplayTitle(event, null)).toBe("bite to eat with mara")
    expect(eventDisplayTitle(event)).toBe("bite to eat with mara")
  })

  it("treats the host as the host", () => {
    expect(eventDisplayTitle(event, "host-1")).toBe("bite to eat")
  })
})
