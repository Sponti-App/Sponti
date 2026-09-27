import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

export const EVENT_UPDATE_BODY_MAX_LENGTH = 500;

// One short text update in a flare's thread (#140). Only the host and guests
// who are `going` can read or post; see eventUpdateService for the rules.
const eventUpdateSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: EVENT_UPDATE_BODY_MAX_LENGTH,
    },
    // Soft delete: a deleted update is left out of every read and count, but
    // the row is kept.
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "event_updates",
    timestamps: true,
  }
);

eventUpdateSchema.index({ eventId: 1, createdAt: 1 });

export type EventUpdateDocument = InferSchemaType<typeof eventUpdateSchema>;

export const EventUpdate: Model<EventUpdateDocument> =
  (mongoose.models.EventUpdate as Model<EventUpdateDocument>) ||
  model<EventUpdateDocument>("EventUpdate", eventUpdateSchema);
