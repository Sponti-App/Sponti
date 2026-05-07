import { Schema, model } from "mongoose";

const notificationSettingsSchema = new Schema({
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
        default: "22:00", // Default start time for quiet hours (10 PM)
    },
    quietHoursEnd: {
        type: String,
        default: "08:00", // Default end time for quiet hours (8 AM)
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
        timestamps: true,
    }
);

export const NotificationSettings = model(
    "NotificationSettings", notificationSettingsSchema);