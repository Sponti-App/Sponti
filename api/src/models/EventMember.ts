import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const eventMemberSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    role: {
      type: String,
      enum: ["host", "admin", "guest"],
      required: true,
    },
    rsvpStatus: {
      type: String,
      enum: ["invited", "going", "maybe", "declined"],
      default: "invited",
      required: true,
    },
    canInviteGuests: {
      type: Boolean,
      default: false,
    },
    memberWillArriveAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "event_members",
    timestamps: true,
  }
);

eventMemberSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventMemberSchema.index({ userId: 1, rsvpStatus: 1 });

export type EventRole = "host" | "admin" | "guest";
export type RsvpStatus = "invited" | "going" | "maybe" | "declined";
export type EventMemberDocument = InferSchemaType<typeof eventMemberSchema>;

export const EventMember: Model<EventMemberDocument> =
  (models.EventMember as Model<EventMemberDocument>) ||
  model<EventMemberDocument>("EventMember", eventMemberSchema);
