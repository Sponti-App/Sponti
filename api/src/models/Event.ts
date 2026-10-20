import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

export const MAX_GUEST_INVITE_LIMIT = 100000;
export const EVENT_TYPES = [
  "food",
  "drinks",
  "sports",
  "hangout",
  "party",
  "culture",
  "hobby",
] as const;
export const EVENT_GUEST_INVITE_MODES = ["multiple", "single", "none"] as const;

/**
 * #225, #614: the longest a flare can run. A set end is at most this long after
 * the start; an open end (`endAt: null`) is over this long after the start.
 */
export const MAX_FLARE_DURATION_MS = 12 * 60 * 60 * 1000;

/** When a flare stops being live: its end, or for an open end the 12h cap. */
export const flareLiveUntil = (startAt: Date, endAt: Date | null | undefined): Date =>
  endAt ?? new Date(startAt.getTime() + MAX_FLARE_DURATION_MS);

const eventSchema = new Schema(
  {
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: EVENT_TYPES,
      default: "hangout",
      required: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    // Null is an open end (#614): the host set no end time.
    endAt: {
      type: Date,
      default: null,
    },
    // Derived, never sent by a client: `endAt`, or start + 12h for an open end
    // (flareLiveUntil). Every "is it over yet" query filters on this, so an open
    // end needs no special case there, and the map's $near query (which can't
    // be combined with $or) stays a plain range. It is set on save; a raw
    // updateOne that changes startAt or endAt must set it too.
    liveUntil: {
      type: Date,
      required: true,
    },
    locationName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
    },
    locationAddress: {
      type: String,
      default: null,
      trim: true,
      maxlength: 240,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value: number[]) => value.length === 2,
          message: "Location coordinates must be [lng, lat]",
        },
      },
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
      required: true,
    },
    allowGuestInvites: {
      type: String,
      enum: EVENT_GUEST_INVITE_MODES,
      default: "none",
      required: true,
    },
    guestInviteLimit: {
      type: Number,
      default: 0,
      min: 0,
      max: MAX_GUEST_INVITE_LIMIT,
    },
    // Internal bookkeeping for the guest-limit gate (#181): a running count of
    // members currently `going`, kept in sync on every transition into or out
    // of going so the gate below can reserve a spot with a single atomic
    // document update instead of counting EventMember rows under a lock.
    // `select: false` keeps it out of every API response by default (and out
    // of the `goingCount` name `attachMemberStats` computes for display,
    // which is a different, always-fresh number) — read it explicitly with
    // `.select("+goingReservationCount")` if it's ever needed.
    // Flares posted before this field existed read it as 0 via the schema
    // default; `goingReservationSyncedAt` marks whether that 0 has been
    // reconciled against the real EventMember count yet (see
    // `reconcileGoingReservation` in eventService.ts) — no migration needed.
    goingReservationCount: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
    goingReservationSyncedAt: {
      type: Date,
      default: null,
      select: false,
    },
    // Circles the host sent this flare to. Circles are expanded into member rows
    // at invite time (a snapshot), so this is the only record of it; it lets us
    // offer to invite someone who is later added to one of these circles.
    // Flares posted before this field existed simply never prompt.
    invitedCircleIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "completed"],
      default: "active",
      required: true,
    },
  },
  {
    collection: "events",
    timestamps: true,
  }
);

eventSchema.pre("validate", function () {
  if (this.startAt) this.liveUntil = flareLiveUntil(this.startAt, this.endAt);
});

eventSchema.index({ hostId: 1, startAt: 1 });
eventSchema.index({ hostId: 1, invitedCircleIds: 1 });
eventSchema.index({ status: 1, visibility: 1, startAt: 1 });
eventSchema.index({ location: "2dsphere" });

export type EventVisibility = "public" | "private";
export type EventStatus = "active" | "cancelled" | "completed";
export type EventType = (typeof EVENT_TYPES)[number];
export type EventGuestInviteMode = (typeof EVENT_GUEST_INVITE_MODES)[number];
export type EventDocument = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventDocument> =
  (mongoose.models.Event as Model<EventDocument>) || model<EventDocument>("Event", eventSchema);

/**
 * #614: fills in `liveUntil` on flares saved before it existed. Run at start-up;
 * it only touches flares without it, so after the first run it does nothing.
 */
export const backfillLiveUntil = async (): Promise<number> => {
  const result = await Event.updateMany(
    { liveUntil: { $exists: false } },
    [
      {
        $set: {
          liveUntil: {
            $ifNull: ["$endAt", { $add: ["$startAt", MAX_FLARE_DURATION_MS] }],
          },
        },
      },
    ],
    // An aggregation-pipeline update, so each flare's own startAt/endAt is read.
    { updatePipeline: true }
  );
  return result.modifiedCount;
};
