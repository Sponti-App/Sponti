import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const qrContactTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: "qr_contact_tokens",
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

qrContactTokenSchema.index({ userId: 1 });

export type QrContactTokenDocument = InferSchemaType<typeof qrContactTokenSchema>;

export const QrContactToken: Model<QrContactTokenDocument> =
  (mongoose.models.QrContactToken as Model<QrContactTokenDocument>) ||
  model<QrContactTokenDocument>("QrContactToken", qrContactTokenSchema);
