import { Schema, model } from "mongoose";

const passwordResetTokenSchema = new Schema({
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
    used: {
        type: Boolean,
        default: false,
    },
},
    {
        timestamps: true,
    }
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = model("PasswordResetToken", passwordResetTokenSchema);
