// Place-less ideas (#515): things to do that are not tied to a spot, so a map
// is never empty, whatever the neighbourhood or the season. They float around
// the person's own position (see lib/flare-ideas-anywhere.ts) and open the
// composer with a title and a category but no fixed place.
//
// Unlike the berlin spots in flare-ideas.data.ts, nothing here is verified
// against a map: it is all editorial copy. Copy is product copy: lowercase,
// short, no exclamation marks, friendly and a little witty.

import type { EventType } from "@/lib/api/events"
import type { IdeaIconKey } from "@/lib/idea-icons"

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night"

export type AnywhereIdea = {
  /** Stable slug, prefixed "anywhere-" so it never collides with a spot's. */
  id: string
  title: string
  blurb?: string
  category: EventType
  /** #524: its own icon; without one the category's shows. */
  icon?: IdeaIconKey
  /** Never set: it lets `idea.place` tell an anywhere idea from a spot (a
   * `FlareIdea` always has a place) without a cast. */
  place?: undefined
  /** Yearly window as "MM-DD", both ends inclusive; `from` after `to` wraps
   * the new year. No season means it works all year. */
  season?: { from: string; to: string }
  /** When in the day it makes sense. No hint means any time. */
  timeOfDay?: readonly TimeOfDay[]
}

export const ANYWHERE_IDEAS: readonly AnywhereIdea[] = [
  {
    id: "anywhere-friends-over",
    title: "have some friends over",
    blurb: "no cleaning, no menu, door open",
    category: "hangout",
    icon: "house",
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-sofa-no-plans",
    title: "two friends, one sofa, zero plans",
    blurb: "the best plan has no steps",
    category: "hangout",
    icon: "couch",
    timeOfDay: ["afternoon", "evening", "night"],
  },
  {
    id: "anywhere-walk-with-a-friend",
    title: "go for a walk with a friend",
    blurb: "no destination needed",
    category: "hangout",
    icon: "walk",
    timeOfDay: ["morning", "afternoon", "evening"],
  },
  {
    id: "anywhere-board-game-night",
    title: "board game night at yours",
    blurb: "bring the box with the missing dice",
    category: "hangout",
    icon: "dice",
    timeOfDay: ["evening", "night"],
  },
  {
    id: "anywhere-sunset-high-spot",
    title: "watch the sunset from the nearest high spot",
    blurb: "a roof, a hill, a very tall bench",
    category: "hangout",
    icon: "sun-horizon",
    season: { from: "04-01", to: "09-30" },
    timeOfDay: ["evening"],
  },
  {
    id: "anywhere-cook-with-friends",
    title: "cook with friends",
    blurb: "one pot, too many cooks",
    category: "food",
    icon: "bowl",
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-potluck",
    title: "a potluck: everyone brings one thing",
    blurb: "dessert twice is a feature",
    category: "food",
    icon: "bowl",
    timeOfDay: ["evening"],
  },
  {
    id: "anywhere-picnic-blanket",
    title: "a picnic blanket and nothing else",
    blurb: "snacks optional, the grass is free",
    category: "food",
    icon: "basket",
    season: { from: "04-15", to: "09-30" },
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-brunch-turns-lunch",
    title: "a brunch that turns into lunch",
    blurb: "nobody checks the clock",
    category: "food",
    icon: "coffee",
    timeOfDay: ["morning"],
  },
  {
    id: "anywhere-bake-and-share",
    title: "bake something and share the evidence",
    blurb: "friends make the best oven mitts",
    category: "food",
    icon: "bread",
    timeOfDay: ["afternoon"],
  },
  {
    id: "anywhere-soup-and-blankets",
    title: "soup and blankets at yours",
    blurb: "a cold-weather classic",
    category: "food",
    icon: "bowl",
    season: { from: "10-15", to: "03-15" },
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-ice-cream-bench",
    title: "an ice cream and a bench",
    blurb: "the bench does the rest",
    category: "food",
    icon: "ice-cream",
    season: { from: "05-01", to: "09-15" },
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-aperitif",
    title: "have a little apéritif",
    blurb: "one bottle, a few snacks, an hour",
    category: "drinks",
    icon: "cocktail",
    timeOfDay: ["evening"],
  },
  {
    id: "anywhere-cupboard-cocktails",
    title: "cocktails from whatever is in the cupboard",
    blurb: "name them after each other",
    category: "drinks",
    icon: "cocktail",
    timeOfDay: ["evening", "night"],
  },
  {
    id: "anywhere-balcony-coffee",
    title: "coffee on the balcony",
    blurb: "a balcony counts as a cafe",
    category: "drinks",
    icon: "coffee",
    season: { from: "04-01", to: "10-15" },
    timeOfDay: ["morning", "afternoon"],
  },
  {
    id: "anywhere-hot-chocolate-walk",
    title: "a hot chocolate walk",
    blurb: "gloves on, mug in hand",
    category: "drinks",
    icon: "coffee",
    season: { from: "11-01", to: "02-28" },
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-mulled-wine",
    title: "mulled wine on the stoop",
    blurb: "the cold is part of the recipe",
    category: "drinks",
    icon: "evergreen",
    season: { from: "11-15", to: "01-06" },
    timeOfDay: ["evening"],
  },
  {
    id: "anywhere-karaoke-living-room",
    title: "karaoke in the living room",
    blurb: "the neighbours will understand",
    category: "party",
    icon: "mic",
    timeOfDay: ["evening", "night"],
  },
  {
    id: "anywhere-kitchen-dance",
    title: "dance in the kitchen",
    blurb: "whoever is closest to the speaker picks",
    category: "party",
    icon: "disco",
    timeOfDay: ["evening", "night"],
  },
  {
    id: "anywhere-tiny-dinner-party",
    title: "a tiny dinner party for four",
    blurb: "candles are the whole decor",
    category: "party",
    icon: "bowl",
    timeOfDay: ["evening"],
  },
  {
    id: "anywhere-run-then-coffee",
    title: "a run, then a coffee",
    blurb: "the coffee is the real goal",
    category: "sports",
    icon: "run",
    timeOfDay: ["morning"],
  },
  {
    id: "anywhere-kick-a-ball",
    title: "kick a ball around",
    blurb: "any ball, any patch of grass",
    category: "sports",
    icon: "ball",
    season: { from: "04-01", to: "10-31" },
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-bike-no-route",
    title: "a bike ride with no route",
    blurb: "left, left, right, who knows",
    category: "sports",
    icon: "bike",
    season: { from: "03-15", to: "10-31" },
    timeOfDay: ["morning", "afternoon"],
  },
  {
    id: "anywhere-stretch-and-lie-down",
    title: "stretch together, then lie on the floor",
    blurb: "yoga without the studio fee",
    category: "sports",
    icon: "tai-chi",
    timeOfDay: ["morning", "evening"],
  },
  {
    id: "anywhere-movie-night",
    title: "movie night, you pick the snacks",
    blurb: "argue about the ending after",
    category: "culture",
    icon: "film",
    timeOfDay: ["evening", "night"],
  },
  {
    id: "anywhere-read-side-by-side",
    title: "read side by side in silence",
    blurb: "together, but quietly",
    category: "culture",
    icon: "books",
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-kitchen-quiz",
    title: "a quiz at the kitchen table",
    blurb: "write the questions, fight about the answers",
    category: "culture",
    icon: "question",
    timeOfDay: ["evening"],
  },
  {
    id: "anywhere-jam-session",
    title: "a jam session with whatever you own",
    blurb: "a pot and a wooden spoon count",
    category: "hobby",
    icon: "music",
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-draw-together",
    title: "draw, doodle or colour in together",
    blurb: "bad drawings only",
    category: "hobby",
    icon: "paint-brush",
    timeOfDay: ["afternoon", "evening"],
  },
  {
    id: "anywhere-swap-session",
    title: "swap books, clothes or plants",
    blurb: "leave with something new",
    category: "hobby",
    icon: "swap",
    timeOfDay: ["afternoon"],
  },
  {
    id: "anywhere-unfinished-projects",
    title: "finish that thing from last year",
    blurb: "we all have one, bring yours",
    category: "hobby",
    icon: "check",
    timeOfDay: ["evening"],
  },
]
