import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

// #639: one browser or home-screen app the user turned web push on in. A user
// can have several; the endpoint identifies the device, so registering an
// endpoint again (after a sign-in as someone else) moves it to the new user.
const pushSubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      type: new Schema(
        { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
        { _id: false }
      ),
      required: true,
    },
    // The device's IANA zone, so quiet hours ("22:00"–"08:00") are read in the
    // recipient's local time. The api knows no other timezone for a user.
    timeZone: {
      type: String,
      default: "UTC",
    },
  },
  {
    collection: "push_subscriptions",
    timestamps: true,
  }
);

export type PushSubscriptionDocument = InferSchemaType<typeof pushSubscriptionSchema>;

export const PushSubscription: Model<PushSubscriptionDocument> =
  (mongoose.models.PushSubscription as Model<PushSubscriptionDocument>) ||
  model<PushSubscriptionDocument>("PushSubscription", pushSubscriptionSchema);
