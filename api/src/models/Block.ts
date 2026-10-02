import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const blockSchema = new Schema(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    collection: "blocks",
    timestamps: true,
  }
);

// The unique pair also serves every lookup by blockerId (its prefix), so
// there is no separate { blockerId } index.
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
// The "blocked by" half of the relationship checks looks blocks up by
// blockedId. Production runs with autoIndex off, so connectDB creates this
// at startup (see db/connect.ts).
blockSchema.index({ blockedId: 1, blockerId: 1 });

export type BlockDocument = InferSchemaType<typeof blockSchema>;

export const Block: Model<BlockDocument> =
  (mongoose.models.Block as Model<BlockDocument>) || model<BlockDocument>("Block", blockSchema);
