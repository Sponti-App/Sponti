import { Schema, model } from "mongoose";

const userSchema = new Schema({
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
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
        default: null
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

export const User = model("User", userSchema);
