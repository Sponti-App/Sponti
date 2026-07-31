import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

// as const is to tell TypeScript that these variables are readOnly and all the methods are forbidden.
export const SYSTEM_CIRCLE_TYPES = ["close", "inner", "all"] as const;
export const CIRCLE_TYPES = [...SYSTEM_CIRCLE_TYPES, "custom"] as const;

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
      default: "custom",
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
circleSchema.index(
  { ownerId: 1, type: 1 },
  {
    name: "unique_system_circle_type_per_owner",
    unique: true,
    partialFilterExpression: {
      type: { $in: [...SYSTEM_CIRCLE_TYPES] },
    },
  }
);

/**
 * typeof extracts all value of the array, but doesn't convert it into an array. For this reason we need [number]
 * It tells TS "Give me the type found at any numeric position in this tuple"
 */

export type CircleType = (typeof CIRCLE_TYPES)[number];
export type SystemCircleType = (typeof SYSTEM_CIRCLE_TYPES)[number];
export type CircleDocument = InferSchemaType<typeof circleSchema>;

export const Circle: Model<CircleDocument> =
  (mongoose.models.Circle as Model<CircleDocument>) ||
  model<CircleDocument>("Circle", circleSchema);
