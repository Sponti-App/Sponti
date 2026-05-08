import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const connectionSchema = new Schema(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      required: true,
    },
    type: {
      type: String,
      enum: ["qr", "shared_invitation", "email_invitation"],
      required: true,
    },
  },
  {
    collection: "connections",
    timestamps: true,
  }
);

connectionSchema.index({ requesterId: 1, receiverId: 1 }, { unique: true });
connectionSchema.index({ receiverId: 1, status: 1 });
connectionSchema.index({ requesterId: 1, status: 1 });

export type ConnectionStatus = "pending" | "accepted" | "rejected";
export type ConnectionType = "qr" | "shared_invitation" | "email_invitation";
export type ConnectionDocument = InferSchemaType<typeof connectionSchema>;

export const Connection: Model<ConnectionDocument> =
  (mongoose.models.Connection as Model<ConnectionDocument>) ||
  model<ConnectionDocument>("Connection", connectionSchema);
