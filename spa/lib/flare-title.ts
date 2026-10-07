// What a flare is called when its host did not write a title (#494).
//
// The api needs a non-empty title, so the composer stores a short phrase
// ("theater outing") instead of leaving it blank. The host's first name is NOT
// stored: it is added when the flare is shown to someone else ("theater
// outing with lukas"), so the host sees their own flare without their own name
// on it. The stored title cannot say whether the host typed it or the composer
// wrote it, so display only adds the name to a title that is exactly one of the
// phrases below, which is harmless for a host who typed the same words.
//
// Flares lit before this wrote [type, host, place, when].join(" · "); those
// are test data, and `parseLegacyTitle` reads them cheaply so they show the
// same phrase instead of the metadata list.

import type { EventType } from "@/lib/api/events"

/** One short phrase per category, used when the place says nothing more. */
export const CATEGORY_PHRASE: Record<EventType, string> = {
  hangout: "hangout",
  drinks: "drinks",
  food: "bite to eat",
  party: "party",
  sports: "sports session",
  culture: "culture outing",
  hobby: "hobby meetup",
}

// \b only knows ASCII letters, so "café" would not end at the é. Match whole
// words with Unicode letter lookarounds instead.
function word(alternatives: string): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, "iu")
}

type PlaceKind = {
  phrase: string
  /** The category this place belongs to. */
  home: EventType
  /** Google Places `primaryType` values. */
  types: readonly string[]
  /** Fallback on the place's name, for when no type came with it. */
  name: RegExp
}

// Ordered most specific first: the first match wins.
const PLACE_KINDS: readonly PlaceKind[] = [
  {
    phrase: "theater outing",
    home: "culture",
    types: ["performing_arts_theater", "amphitheatre"],
    name: word("theat(?:er|re)|schauspielhaus|volksb[uü]hne"),
  },
  {
    phrase: "cinema outing",
    home: "culture",
    types: ["movie_theater"],
    name: word("cinema|kino"),
  },
  {
    phrase: "concert outing",
    home: "culture",
    types: ["concert_hall", "opera_house"],
    name: word("concert hall|konzerthaus|philharmonie|oper"),
  },
  {
    phrase: "museum visit",
    home: "culture",
    types: ["museum"],
    name: word("museum|museen"),
  },
  {
    phrase: "gallery visit",
    home: "culture",
    types: ["art_gallery"],
    name: word("gallery|galerie"),
  },
  {
    phrase: "drinks",
    home: "drinks",
    types: ["bar", "pub", "wine_bar", "bar_and_grill", "brewpub"],
    name: word("bar|pub|biergarten|brewery|taproom"),
  },
  {
    phrase: "coffee",
    home: "food",
    types: ["cafe", "coffee_shop", "tea_house"],
    name: word("caf[eé]|coffee|kaffee|roastery"),
  },
  {
    phrase: "club night",
    home: "party",
    types: ["night_club"],
    name: word("night ?club"),
  },
  {
    phrase: "workout",
    home: "sports",
    types: ["gym", "fitness_center", "sports_complex", "swimming_pool"],
    name: word("gym|fitness"),
  },
  {
    phrase: "park hangout",
    home: "hangout",
    types: ["park", "state_park", "national_park", "city_park"],
    name: word("park"),
  },
]

/**
 * Categories too loose to contradict a place: a hangout or a hobby at a
 * theater is a theater outing. A specific category the host picked (sports at
 * a bar) keeps its own phrase unless the place belongs to that same category.
 */
const LOOSE_CATEGORIES: readonly EventType[] = ["hangout", "hobby"]

export type FlarePlace = {
  /** Google Places `primaryType`, e.g. "performing_arts_theater". */
  placeType?: string | null
  placeName?: string | null
}

export type ComposeFlareTitleInput = FlarePlace & { type: EventType }

function placeKindOf({ placeType, placeName }: FlarePlace): PlaceKind | null {
  const type = placeType?.trim().toLowerCase()
  if (type) {
    const byType = PLACE_KINDS.find((kind) => kind.types.includes(type))
    if (byType) return byType
  }
  const name = placeName?.trim()
  if (name) return PLACE_KINDS.find((kind) => kind.name.test(name)) ?? null
  return null
}

/**
 * The title without the host: the place's kind when it says more than the
 * category ("theater outing"), else the category's phrase.
 */
export function composeFlareTitle(input: ComposeFlareTitleInput): string {
  const kind = placeKindOf(input)
  if (
    kind &&
    (kind.home === input.type || LOOSE_CATEGORIES.includes(input.type))
  ) {
    return kind.phrase
  }
  return CATEGORY_PHRASE[input.type] ?? CATEGORY_PHRASE.hangout
}

/** "lukas hanus" -> "lukas". Null for a missing name or a placeholder. */
export function hostFirstName(name?: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0]?.toLowerCase()
  if (!first || first === "you" || first === "host") return null
  return first
}

function withHost(phrase: string, hostName?: string | null): string {
  const first = hostFirstName(hostName)
  return first ? `${phrase} with ${first}` : phrase
}

const GENERATED_PHRASES: ReadonlySet<string> = new Set([
  ...Object.values(CATEGORY_PHRASE),
  ...PLACE_KINDS.map((kind) => kind.phrase),
])

/** Whether the title is exactly one the composer writes. */
export function isGeneratedFlareTitle(title: string): boolean {
  return GENERATED_PHRASES.has(title.trim().toLowerCase())
}

const LEGACY_SEPARATOR = " · "

/**
 * Reads a title written as [type, host, place?, when].join(" · ") and
 * returns the pieces, or null for any other title. The first part must be a
 * category, and the flare's own type when it is known, which keeps a title
 * someone typed with a "·" in it alone.
 */
export function parseLegacyTitle(
  title: string,
  type?: EventType
): { type: EventType; host: string; place: string | null } | null {
  const parts = title.split(LEGACY_SEPARATOR)
  if (parts.length < 3 || parts.length > 4) return null
  const first = parts[0].trim().toLowerCase()
  if (!Object.hasOwn(CATEGORY_PHRASE, first)) return null
  if (type && first !== type) return null
  const host = parts[1].trim()
  if (!host) return null
  const place = parts.length === 4 ? parts[2].trim() : ""
  return { type: first as EventType, host, place: place || null }
}

export type DisplayFlareTitleInput = {
  /** The title as the api stores it. */
  title: string
  /** The flare's category, when the surface has it. */
  type?: EventType
  /** The flare's host's name; absent when the api only sent an id. */
  hostName?: string | null
  /** The viewer is the host: their own name stays off their own flare. */
  isHost: boolean
}

/**
 * The title to show for a flare: what the host wrote, or for a flare they left
 * untitled the composer's phrase plus "with <host first name>" for everyone
 * but the host.
 */
export function displayFlareTitle({
  title,
  type,
  hostName,
  isHost,
}: DisplayFlareTitleInput): string {
  const text = title.trim()
  const legacy = parseLegacyTitle(text, type)
  if (legacy) {
    const phrase = composeFlareTitle({
      type: legacy.type,
      placeName: legacy.place,
    })
    return isHost ? phrase : withHost(phrase, hostName ?? legacy.host)
  }
  if (!isHost && isGeneratedFlareTitle(text)) return withHost(text, hostName)
  return text
}

/** `displayFlareTitle` for an event as the map and calendar hold it. */
export function eventDisplayTitle(
  event: {
    title: string
    type: EventType
    host?: { id?: string; name?: string } | null
  },
  viewerId?: string | null
): string {
  return displayFlareTitle({
    title: event.title,
    type: event.type,
    hostName: event.host?.name,
    isHost: Boolean(viewerId && event.host?.id === viewerId),
  })
}
