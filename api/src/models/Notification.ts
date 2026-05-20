import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

export const NOTIFICATION_TYPES = [
  "event_invitation",
  "event_reactivated",
  "event_cancelled",
  "connection_request",
  "connection_accepted",
  "event_rsvp_change",
] as const;

export const NOTIFICATION_TARGET_TYPES = ["event", "connection", "user"] as const;

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    targetType: {
      type: String,
      enum: NOTIFICATION_TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: "notifications",
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ targetType: 1, targetId: 1, type: 1 });

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationTargetType = (typeof NOTIFICATION_TARGET_TYPES)[number];
export type NotificationDocument = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationDocument> =
  (mongoose.models.Notification as Model<NotificationDocument>) ||
  model<NotificationDocument>("Notification", notificationSchema);
