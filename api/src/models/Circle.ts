import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const circleSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    color: {
      type: String,
      default: null,
      trim: true,
      maxlength: 32,
    },
  },
  {
    collection: "circles",
    timestamps: true,
  }
);

circleSchema.index({ ownerId: 1 });

export type CircleDocument = InferSchemaType<typeof circleSchema>;

export const Circle: Model<CircleDocument> =
  (models.Circle as Model<CircleDocument>) || model<CircleDocument>("Circle", circleSchema);
