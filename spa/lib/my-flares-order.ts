import { deriveStatus, type HostedEvent } from "@/lib/api/events"

// The order of a my-flares section (#581). The api lists flares by start
// time, oldest first, with cancelled ones mixed in, so a long-running or
// cancelled flare sat above the one just lit. Here: live flares first, the
// most recently started on top, then upcoming flares, the soonest first.
// Cancelled flares are split off for the folded "show N cancelled" list,
// the most recent first.
export function orderMyFlares(
  events: HostedEvent[],
  now: number = Date.now()
): { active: HostedEvent[]; cancelled: HostedEvent[] } {
  const start = (e: HostedEvent) => new Date(e.startAt).getTime()
  const live: HostedEvent[] = []
  const later: HostedEvent[] = []
  const cancelled: HostedEvent[] = []
  for (const event of events) {
    const status = deriveStatus(event, now)
    if (status === "cancelled") cancelled.push(event)
    else if (status === "live") live.push(event)
    else later.push(event)
  }
  live.sort((a, b) => start(b) - start(a))
  later.sort((a, b) => start(a) - start(b))
  cancelled.sort((a, b) => start(b) - start(a))
  return { active: [...live, ...later], cancelled }
}
