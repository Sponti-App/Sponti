import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    displayName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: {
        type: String,
        required: true
    },
    avatarUrl: {
        type: String,
        default: null
    },
    avatarPublicId: {
        type: String,
        default: null,
    },
    profileVisibility: {
        type: String,
        enum: ["public", "private"],
        default: "public",
    },
    socialBattery: {
        type: Number,
        default: 100,
    },
},
    {
        timestamps: true,
    }
);

export const User = mongoose.model("User", userSchema);