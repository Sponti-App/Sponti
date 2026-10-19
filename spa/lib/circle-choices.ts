import type { Circle, CircleType } from "@/lib/circles"

// Which circles to offer after accepting someone (#226), and in what order.
//
// "all friends" is left out: an accepted connection is in it automatically
// (#154). So is any circle the person is already in.
//
// Order is "how much you use it", read from the one signal we already have
// without another request: how many people you've put in the circle. A
// circle you keep adding people to is one you reach for. Ties (typically a
// new account, where every circle is empty) fall back to the system order —
// close friends, inner circle, then custom circles by name — so the chips
// don't reshuffle between renders. Nothing is singled out as "suggested":
// this is only an order.

const TYPE_ORDER: Record<CircleType, number> = {
  close: 0,
  inner: 1,
  custom: 2,
  all: 3,
}

export function orderCircleChoices(
  circles: Circle[],
  personId?: string | null,
  // #616: the circles a flare went to, when the person came through that
  // flare's invite link. They go first, whatever their size.
  firstIds: readonly string[] = []
): Circle[] {
  const first = (circle: Circle) => (firstIds.includes(circle.id) ? 0 : 1)
  return circles
    .filter((circle) => circle.type !== "all")
    .filter((circle) => !personId || !circle.memberIds.includes(personId))
    .sort(
      (a, b) =>
        first(a) - first(b) ||
        b.memberIds.length - a.memberIds.length ||
        TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
        a.name.localeCompare(b.name)
    )
}

/**
 * Whether to offer the circle chips for someone who is already a friend
 * (#585): there is a circle besides "all friends" to put them in, and they
 * aren't in one yet. False while the circles load, so a feed full of
 * `connection_accepted` rows doesn't flash spinners, and once they have been
 * placed, so the chips don't come back on the next visit.
 */
export function shouldOfferCircles(
  circles: Circle[] | null,
  personId: string | null | undefined
): boolean {
  if (!circles || !personId) return false
  const others = circles.filter((circle) => circle.type !== "all")
  return (
    others.length > 0 &&
    others.every((circle) => !circle.memberIds.includes(personId))
  )
}
