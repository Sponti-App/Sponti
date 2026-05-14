import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

export const CIRCLE_TYPES = ["close", "inner", "all"] as const;

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
    type: {
      type: String,
      enum: CIRCLE_TYPES,
      default: "close",
      required: true,
      trim: true,
    },
    icon: {
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
circleSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export type CircleType = (typeof CIRCLE_TYPES)[number];
export type CircleDocument = InferSchemaType<typeof circleSchema>;

export const Circle: Model<CircleDocument> =
  (mongoose.models.Circle as Model<CircleDocument>) ||
  model<CircleDocument>("Circle", circleSchema);
