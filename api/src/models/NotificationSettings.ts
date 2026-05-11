import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const notificationSettingsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    quietHoursEnabled: {
      type: Boolean,
      default: false,
    },
    quietHoursStart: {
      type: String,
      default: "22:00",
    },
    quietHoursEnd: {
      type: String,
      default: "08:00",
    },
    eventReminders: {
      type: Boolean,
      default: true,
    },
    invitationNotifications: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: "notification_settings",
    timestamps: true,
  }
);

notificationSettingsSchema.index({ userId: 1 }, { unique: true });

export type NotificationSettingsDocument = InferSchemaType<typeof notificationSettingsSchema>;

export const NotificationSettings: Model<NotificationSettingsDocument> =
  (mongoose.models.NotificationSettings as Model<NotificationSettingsDocument>) ||
  model<NotificationSettingsDocument>("NotificationSettings", notificationSettingsSchema);
