import { describe, expect, it } from "vitest";
import { createEventBodySchema } from "./eventSchemas.js";

const baseCreateEventBody = {
  title: "coffee after class",
  startAt: "2026-05-14T13:00:00.000Z",
  endAt: "2026-05-14T14:00:00.000Z",
  locationName: "Hamburg",
  location: { type: "Point", coordinates: [9.9937, 53.5511] },
};

describe("createEventBodySchema", () => {
  it("keeps a valid event type from the create request", () => {
    const result = createEventBodySchema.parse({
      ...baseCreateEventBody,
      type: "drinks",
    });

    expect(result.type).toBe("drinks");
  });

  it("rejects invalid event types instead of defaulting them", () => {
    const result = createEventBodySchema.safeParse({
      ...baseCreateEventBody,
      type: "karaoke",
    });

    expect(result.success).toBe(false);
  });
});
