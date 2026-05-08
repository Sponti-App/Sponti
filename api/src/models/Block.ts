import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

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

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
blockSchema.index({ blockerId: 1 });

export type BlockDocument = InferSchemaType<typeof blockSchema>;

export const Block: Model<BlockDocument> =
  (models.Block as Model<BlockDocument>) || model<BlockDocument>("Block", blockSchema);
