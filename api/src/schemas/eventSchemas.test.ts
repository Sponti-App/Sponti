import { describe, expect, it } from "vitest";
import {
  createEventBodySchema,
  createEventUpdateBodySchema,
  inviteEventMembersBodySchema,
  updateMyEventMembershipBodySchema,
} from "./eventSchemas.js";

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

describe("updateMyEventMembershipBodySchema", () => {
  it("rejects deprecated maybe RSVP writes", () => {
    const result = updateMyEventMembershipBodySchema.safeParse({
      rsvpStatus: "maybe",
    });

    expect(result.success).toBe(false);
  });
});

describe("inviteEventMembersBodySchema", () => {
  it("defaults the role to guest for friends and circles", () => {
    const result = inviteEventMembersBodySchema.parse({
      members: [{ userId: "507f1f77bcf86cd799439013" }],
      circles: [{ circleId: "507f1f77bcf86cd799439015" }],
    });

    expect(result.members[0]?.role).toBe("guest");
    expect(result.circles[0]?.role).toBe("guest");
  });

  it("rejects an empty invite", () => {
    expect(inviteEventMembersBodySchema.safeParse({}).success).toBe(false);
    expect(inviteEventMembersBodySchema.safeParse({ members: [], circles: [] }).success).toBe(
      false
    );
  });
});

describe("createEventUpdateBodySchema (#140)", () => {
  it("trims the body and accepts up to 500 characters", () => {
    expect(createEventUpdateBodySchema.parse({ body: "  running 10 late  " })).toEqual({
      body: "running 10 late",
    });
    expect(createEventUpdateBodySchema.safeParse({ body: "a".repeat(500) }).success).toBe(true);
  });

  it("rejects an empty, whitespace-only or too long body", () => {
    expect(createEventUpdateBodySchema.safeParse({ body: "" }).success).toBe(false);
    expect(createEventUpdateBodySchema.safeParse({ body: "   \n\t " }).success).toBe(false);
    expect(createEventUpdateBodySchema.safeParse({ body: "a".repeat(501) }).success).toBe(false);
    expect(createEventUpdateBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown fields such as a client-supplied author", () => {
    const result = createEventUpdateBodySchema.safeParse({
      body: "hi",
      authorId: "507f1f77bcf86cd799439011",
    });

    expect(result.success).toBe(false);
  });
});
