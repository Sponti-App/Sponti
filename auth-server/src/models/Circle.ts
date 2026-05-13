import { model, Schema, Types } from "mongoose";

const circleTypes = ["close", "inner", "all"] as const;

type CircleType = (typeof circleTypes)[number];

interface CircleDocument {
  ownerId: Types.ObjectId;
  name: string;
  color: string;
  type: CircleType;
  icon?: string | null;
}

const circleSchema = new Schema<CircleDocument>(
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
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: circleTypes,
      required: true,
      trim: true,
      default: "close",
    },
    icon: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

circleSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export const Circle = model("Circle", circleSchema);
