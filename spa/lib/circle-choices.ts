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
  personId?: string | null
): Circle[] {
  return circles
    .filter((circle) => circle.type !== "all")
    .filter((circle) => !personId || !circle.memberIds.includes(personId))
    .sort(
      (a, b) =>
        b.memberIds.length - a.memberIds.length ||
        TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
        a.name.localeCompare(b.name)
    )
}
