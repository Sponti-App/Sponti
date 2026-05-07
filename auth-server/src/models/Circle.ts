import { model, Schema } from "mongoose";

const circleSchema = new Schema({
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
},
    {
        timestamps: true,
    }
);

export const Circle = model("Circle", circleSchema);