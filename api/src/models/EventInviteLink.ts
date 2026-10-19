import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

// A flare's own invite link (#616): one unguessable token per flare. Having it
// counts as being invited, so the host chooses who to send it to and it works
// for invite-only flares too.
//
// Kept in its own collection rather than on the event: event documents are
// read `.lean()` by the map, the lists and the detail endpoints, so a token
// field there would be one missed projection away from reaching a guest. Here
// only the host's own `GET /events/:id/invite-link` ever returns it.
//
// One row per flare. Resetting replaces the token in place, so the old link
// stops working at once. There is no expiry of its own: the link lives as long
// as the flare is active and not ended (checked on every use).
const eventInviteLinkSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    collection: "event_invite_links",
    timestamps: true,
  }
);

export type EventInviteLinkDocument = InferSchemaType<typeof eventInviteLinkSchema>;

export const EventInviteLink: Model<EventInviteLinkDocument> =
  (mongoose.models.EventInviteLink as Model<EventInviteLinkDocument>) ||
  model<EventInviteLinkDocument>("EventInviteLink", eventInviteLinkSchema);
