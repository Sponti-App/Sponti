import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const circleMemberSchema = new Schema(
  {
    circleId: {
      type: Schema.Types.ObjectId,
      ref: "Circle",
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    collection: "circle_members",
    timestamps: true,
  }
);

circleMemberSchema.index({ circleId: 1, userId: 1 }, { unique: true });
circleMemberSchema.index({ ownerId: 1, userId: 1 });

export type CircleMemberDocument = InferSchemaType<typeof circleMemberSchema>;

export const CircleMember: Model<CircleMemberDocument> =
  (mongoose.models.CircleMember as Model<CircleMemberDocument>) ||
  model<CircleMemberDocument>("CircleMember", circleMemberSchema);
