import { Schema, model } from "mongoose";

const refreshTokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    revokedAt: {
        type: Date,
        default: null,
    },
},
    {
        timestamps: true,
    }
);

export const RefreshToken = model("RefreshToken", refreshTokenSchema);