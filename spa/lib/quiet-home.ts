// #522: the quiet home's "you recently connected" row. A connection counts
// as recent for 14 days after it was accepted; the row shows at most three,
// newest first, and is hidden when nobody is that recent.

import type { Connection } from "@/lib/circles"

export const RECENT_CONNECTION_DAYS = 14
export const RECENT_CONNECTION_MAX = 3

const DAY_MS = 24 * 60 * 60 * 1000

export function recentConnections(
  connections: readonly Connection[],
  now: number
): Connection[] {
  const since = now - RECENT_CONNECTION_DAYS * DAY_MS
  return connections
    .filter((c) => {
      const at = c.connectedAt ? Date.parse(c.connectedAt) : NaN
      return Number.isFinite(at) && at >= since && at <= now + DAY_MS
    })
    .sort((a, b) => Date.parse(b.connectedAt!) - Date.parse(a.connectedAt!))
    .slice(0, RECENT_CONNECTION_MAX)
}

/** "today", "yesterday", "3 days ago", "last week". */
export function connectedAgo(connectedAt: string, now: number): string {
  const days = Math.floor((now - Date.parse(connectedAt)) / DAY_MS)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return "last week"
}
