import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

// An invite to an invite-only flare that is waiting on the host (#616): the
// guest opened the flare's invite link but is not a friend of the host yet, so
// redeeming sent the host a friend request instead of opening the flare. When
// the host accepts that request (or the two connect any other way) the guest
// is invited to the flare; if the host declines, the guest cancels, or the
// flare ends first, the row lapses and grants nothing.
//
// Only ever created for flares that are not open to all: an open-to-all flare
// needs no invite, the guest just joins.
const pendingEventInviteSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    guestId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    collection: "pending_event_invites",
    timestamps: { createdAt: true, updatedAt: false },
  }
);

pendingEventInviteSchema.index({ eventId: 1, guestId: 1 }, { unique: true });
pendingEventInviteSchema.index({ hostId: 1, guestId: 1 });

export type PendingEventInviteDocument = InferSchemaType<typeof pendingEventInviteSchema>;

export const PendingEventInvite: Model<PendingEventInviteDocument> =
  (mongoose.models.PendingEventInvite as Model<PendingEventInviteDocument>) ||
  model<PendingEventInviteDocument>("PendingEventInvite", pendingEventInviteSchema);
