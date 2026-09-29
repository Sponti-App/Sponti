// DRAFT list of berlin idea spots (#242), for the team to review before any
// tester sees it. There is no owner yet (#240 open decision): nobody is
// responsible for adding spots or keeping season windows fresh.
//
// Every coordinate was checked against OpenStreetMap (Nominatim) and, where an
// article exists, Wikipedia. Season windows and the "sundays" / "thursdays"
// style hints in blurbs are editorial guesses about a typical year, not
// verified opening times.
//
// Copy is product copy: lowercase, short, no exclamation marks. `place.name`
// is the proper name of the place, as it would be stored on a flare.

import type { EventType } from "@/lib/api/events"

export type FlareIdea = {
  /** Stable slug. */
  id: string
  title: string
  blurb?: string
  category: EventType
  place: { name: string; lat: number; lng: number; address?: string }
  /** Yearly window as "MM-DD", both ends inclusive. `from` after `to` means
   * the window wraps the new year (e.g. "12-28" to "01-01"). */
  season?: { from: string; to: string }
}

export const FLARE_IDEAS: readonly FlareIdea[] = [
  {
    id: "humboldthain-rose-garden",
    title: "roses are blooming at humboldthain",
    blurb: "bring a blanket and a friend",
    category: "hangout",
    place: {
      name: "Humboldthain Rosengarten",
      lat: 52.5474434,
      lng: 13.3872879,
    },
    season: { from: "06-01", to: "07-15" },
  },
  {
    id: "gaerten-der-welt-cherry-blossom",
    title: "cherry blossoms at gärten der welt",
    blurb: "walk under the blossoms",
    category: "hangout",
    place: { name: "Gärten der Welt", lat: 52.5372553, lng: 13.5749239 },
    season: { from: "04-01", to: "04-30" },
  },
  {
    id: "viktoriapark-hill",
    title: "climb the hill at viktoriapark",
    blurb: "a view over kreuzberg and a waterfall on the way",
    category: "hangout",
    place: { name: "Viktoriapark", lat: 52.4874665, lng: 13.3808123 },
  },
  {
    id: "admiralbruecke-canal",
    title: "canal evening on the admiralbrücke",
    blurb: "grab a drink and sit on the bridge",
    category: "hangout",
    place: { name: "Admiralbrücke", lat: 52.4952677, lng: 13.4151439 },
  },
  {
    id: "tempelhofer-feld",
    title: "run, skate or fly a kite on tempelhofer feld",
    blurb: "an old runway with a lot of sky",
    category: "sports",
    place: { name: "Tempelhofer Feld", lat: 52.4744192, lng: 13.4026007 },
  },
  {
    id: "schlachtensee-swim",
    title: "swim at schlachtensee",
    blurb: "clear water, forest all around",
    category: "sports",
    place: { name: "Schlachtensee", lat: 52.4412683, lng: 13.208466 },
    season: { from: "06-01", to: "09-15" },
  },
  {
    id: "ploetzensee-swim",
    title: "swim at plötzensee",
    blurb: "a quick lake dip in the north of the city",
    category: "sports",
    place: { name: "Plötzensee", lat: 52.5442537, lng: 13.3299692 },
    season: { from: "06-01", to: "09-15" },
  },
  {
    id: "prinzenbad-summer-pool",
    title: "laps and lounging at prinzenbad",
    blurb: "kreuzberg's outdoor pool",
    category: "sports",
    place: { name: "Sommerbad Kreuzberg", lat: 52.4975998, lng: 13.4026495 },
    season: { from: "05-15", to: "09-15" },
  },
  {
    id: "prater-beer-garden",
    title: "beer garden evening at prater",
    blurb: "berlin's oldest beer garden, chestnut trees included",
    category: "drinks",
    place: { name: "Prater Biergarten", lat: 52.5402446, lng: 13.4095113 },
    season: { from: "04-15", to: "09-30" },
  },
  {
    id: "klunkerkranich-rooftop",
    title: "sunset drinks on the klunkerkranich roof",
    blurb: "rooftop above the neukölln arcaden",
    category: "drinks",
    place: { name: "Klunkerkranich", lat: 52.4820706, lng: 13.4313317 },
    season: { from: "04-15", to: "10-15" },
  },
  {
    id: "cafe-am-neuen-see",
    title: "a beer by the neuer see",
    blurb: "beer garden on the lake in tiergarten",
    category: "drinks",
    place: { name: "Café am Neuen See", lat: 52.5105074, lng: 13.3442988 },
  },
  {
    id: "gendarmenmarkt-christmas-market",
    title: "glühwein at the gendarmenmarkt christmas market",
    blurb: "between the two cathedrals",
    category: "drinks",
    place: { name: "Gendarmenmarkt", lat: 52.5135698, lng: 13.392297 },
    season: { from: "11-20", to: "12-30" },
  },
  {
    id: "markthalle-neun",
    title: "eat your way through markthalle neun",
    blurb: "street food thursday is the big one",
    category: "food",
    place: { name: "Markthalle Neun", lat: 52.5021661, lng: 13.4314886 },
  },
  {
    id: "maybachufer-market",
    title: "market lunch at the maybachufer",
    blurb: "tuesdays and fridays along the canal",
    category: "food",
    place: {
      name: "Wochenmarkt am Maybachufer",
      lat: 52.4952407,
      lng: 13.422854,
    },
  },
  {
    id: "thai-park-picnic",
    title: "thai food picnic at preußenpark",
    blurb: "sundays, cash and a blanket",
    category: "food",
    place: { name: "Preußenpark", lat: 52.4924987, lng: 13.3131211 },
    season: { from: "04-15", to: "10-15" },
  },
  {
    id: "mauerpark-karaoke",
    title: "sing along at the mauerpark amphitheater",
    blurb: "open-air karaoke on sunday afternoons",
    category: "party",
    place: {
      name: "Amphitheater im Mauerpark",
      lat: 52.5428861,
      lng: 13.4032768,
    },
    season: { from: "04-15", to: "10-15" },
  },
  {
    id: "brandenburger-tor-new-years-eve",
    title: "new year's eve at the brandenburger tor",
    blurb: "an open-air countdown at the gate",
    category: "party",
    place: { name: "Brandenburger Tor", lat: 52.5162699, lng: 13.3777034 },
    season: { from: "12-28", to: "01-01" },
  },
  {
    id: "teufelsberg-sunset",
    title: "sunset at teufelsberg",
    blurb: "graffiti, an old listening station and the whole city below",
    category: "culture",
    place: { name: "Teufelsberg", lat: 52.4977183, lng: 13.2429543 },
  },
  {
    id: "east-side-gallery",
    title: "walk the east side gallery",
    blurb: "the longest stretch of wall still standing",
    category: "culture",
    place: { name: "East Side Gallery", lat: 52.5044542, lng: 13.4408392 },
  },
  {
    id: "siegessaeule-view",
    title: "climb the siegessäule",
    blurb: "285 steps up for a view over tiergarten",
    category: "culture",
    place: { name: "Siegessäule", lat: 52.5145082, lng: 13.3501108 },
  },
  {
    id: "mauerpark-flea-market",
    title: "hunt for treasure at the mauerpark flea market",
    blurb: "sundays, and worth going early",
    category: "hobby",
    place: { name: "Flohmarkt am Mauerpark", lat: 52.5415157, lng: 13.4023137 },
  },
  {
    id: "prinzessinnengarten-gardening",
    title: "get your hands dirty at prinzessinnengarten",
    blurb: "a community garden in the middle of kreuzberg",
    category: "hobby",
    place: { name: "Prinzessinnengarten", lat: 52.5030159, lng: 13.411087 },
    season: { from: "04-01", to: "10-31" },
  },
  {
    id: "botanischer-garten-dahlem",
    title: "wander the botanischer garten",
    blurb: "greenhouses for the days it rains",
    category: "hobby",
    place: { name: "Botanischer Garten Berlin", lat: 52.45414, lng: 13.306653 },
  },
]
