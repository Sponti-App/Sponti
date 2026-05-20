// Frontend models for circles, connections and blocks. IDs are backend
// Mongo/ObjectId strings; circle.type carries the tier/custom category.

export type Connection = {
  id: string
  connectionId?: string
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
  color?: string | null
  icon?: string | null
  memberAddedAt?: Record<string, string>
}

export type BlockedUser = {
  id: string
  displayName: string
  username: string
  blockedAt: string
}

const DAY = 24 * 60 * 60 * 1000

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
