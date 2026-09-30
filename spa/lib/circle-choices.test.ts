import { describe, expect, it } from "vitest"
import type { Circle } from "@/lib/circles"
import { orderCircleChoices } from "./circle-choices"

function circle(overrides: Partial<Circle> & Pick<Circle, "id">): Circle {
  return {
    name: overrides.id,
    description: "",
    memberIds: [],
    type: "custom",
    ...overrides,
  }
}

describe("orderCircleChoices (#226)", () => {
  it("leaves out all friends and circles the person is already in", () => {
    const result = orderCircleChoices(
      [
        circle({ id: "all", type: "all", memberIds: ["a", "b", "c"] }),
        circle({ id: "close", type: "close", memberIds: ["p"] }),
        circle({ id: "inner", type: "inner" }),
      ],
      "p"
    )

    expect(result.map((c) => c.id)).toEqual(["inner"])
  })

  it("puts the circles with the most people first", () => {
    const result = orderCircleChoices([
      circle({ id: "close", type: "close", memberIds: ["a"] }),
      circle({ id: "inner", type: "inner" }),
      circle({ id: "climbing", memberIds: ["a", "b", "c"] }),
    ])

    expect(result.map((c) => c.id)).toEqual(["climbing", "close", "inner"])
  })

  it("breaks ties with close, inner, then custom circles by name", () => {
    const result = orderCircleChoices([
      circle({ id: "zoo", name: "zoo crew" }),
      circle({ id: "inner", type: "inner" }),
      circle({ id: "book", name: "book club" }),
      circle({ id: "close", type: "close" }),
    ])

    expect(result.map((c) => c.id)).toEqual(["close", "inner", "book", "zoo"])
  })

  it("doesn't reorder the list it was given", () => {
    const input = [
      circle({ id: "inner", type: "inner" }),
      circle({ id: "close", type: "close" }),
    ]
    orderCircleChoices(input)
    expect(input.map((c) => c.id)).toEqual(["inner", "close"])
  })
})
