// Frontend models for circles, connections and blocks. Shape matches the
// circles / circle_members / connections / blocks Mongo collections so the
// real fetch layer can drop in without UI changes.

export type Connection = {
  id: string
  displayName: string
  username: string
  note?: string
}

export type ConnectionRequest = {
  id: string
  user: Connection
  createdAt: string
}

export type CircleType = "close" | "inner" | "all" | "custom"

export type Circle = {
  id: string
  name: string
  description: string
  memberIds: string[]
  type: CircleType
  memberAddedAt?: Record<string, string>
}

export type BlockedUser = {
  id: string
  displayName: string
  username: string
  blockedAt: string
}

export const MOCK_CONNECTIONS: Connection[] = [
  {
    id: "maya",
    displayName: "Maya R.",
    username: "mayar",
    note: "coffee, walks, study breaks",
  },
  {
    id: "jordan",
    displayName: "Jordan T.",
    username: "jordant",
    note: "lunch and weekend plans",
  },
  { id: "sam", displayName: "Sam K.", username: "samk", note: "classmate" },
  {
    id: "avery",
    displayName: "Avery L.",
    username: "averyl",
    note: "nearby evenings",
  },
  {
    id: "noah",
    displayName: "Noah P.",
    username: "noahp",
    note: "board games and food",
  },
  {
    id: "riley",
    displayName: "Riley M.",
    username: "rileym",
    note: "gym, parks, events",
  },
  {
    id: "lina",
    displayName: "Lina S.",
    username: "linas",
    note: "studio crew",
  },
  {
    id: "emil",
    displayName: "Emil A.",
    username: "emila",
    note: "weekend plans",
  },
]

export const MOCK_CIRCLES: Circle[] = [
  {
    id: "inner",
    name: "inner circle",
    description: "your tightest 5",
    type: "inner",
    memberIds: ["maya", "jordan", "sam", "avery", "noah"],
    memberAddedAt: {
      maya:   "2026-04-10T10:00:00.000Z",
      jordan: "2026-04-20T14:00:00.000Z",
      sam:    "2026-04-28T09:00:00.000Z",
      avery:  "2026-05-05T17:00:00.000Z",
      noah:   "2026-05-12T11:00:00.000Z",
    },
  },
  {
    id: "close",
    name: "close friends",
    description: "your tighter group",
    type: "close",
    memberIds: ["maya", "sam", "riley", "lina"],
    memberAddedAt: {
      maya:  "2026-03-15T10:00:00.000Z",
      sam:   "2026-04-01T09:00:00.000Z",
      riley: "2026-05-01T13:00:00.000Z",
      lina:  "2026-05-13T16:00:00.000Z",
    },
  },
  {
    id: "all",
    name: "all friends",
    description: "everyone you follow",
    type: "all",
    memberIds: MOCK_CONNECTIONS.map((c) => c.id),
    memberAddedAt: {
      maya:   "2026-03-10T10:00:00.000Z",
      jordan: "2026-04-01T14:00:00.000Z",
      sam:    "2026-04-15T09:00:00.000Z",
      avery:  "2026-04-20T17:00:00.000Z",
      noah:   "2026-04-28T11:00:00.000Z",
      riley:  "2026-05-01T13:00:00.000Z",
      lina:   "2026-05-13T16:00:00.000Z",
      emil:   "2026-05-14T08:00:00.000Z",
    },
  },
]

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const MOCK_REQUESTS: ConnectionRequest[] = [
  {
    id: "req-kai",
    user: {
      id: "kai",
      displayName: "Kai B.",
      username: "kaib",
      note: "met at the studio",
    },
    createdAt: new Date(Date.now() - 30 * MIN).toISOString(),
  },
  {
    id: "req-tay",
    user: { id: "tay", displayName: "Tay W.", username: "tayw" },
    createdAt: new Date(Date.now() - 4 * HOUR).toISOString(),
  },
]

export const MOCK_BLOCKED: BlockedUser[] = [
  {
    id: "ex-user",
    displayName: "Ex User",
    username: "exuser",
    blockedAt: new Date(Date.now() - 7 * DAY).toISOString(),
  },
]

// Pool of strangers the @handle search can match against. Shrinks as the user
// sends requests during the prototype session.
export const MOCK_DISCOVERABLE: Connection[] = [
  { id: "iris", displayName: "Iris N.", username: "irisn" },
  { id: "olu", displayName: "Olu A.", username: "oluadebayo" },
  { id: "mira", displayName: "Mira J.", username: "mira" },
  { id: "lin", displayName: "Lin", username: "lin_w" },
  { id: "nick", displayName: "Nick T.", username: "nickt" },
]

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .replace(/\./g, "")
    .slice(0, 2)
    .toUpperCase()
}

export function formatBlockedAt(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / DAY)
  if (days < 1) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return `${months}mo ago`
}
