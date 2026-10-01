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
        sparse: true
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
    // Self-authored profile fields, validated and normalised by
    // updateProfileSchema (see lib/profileFields.ts). Returned only to the
    // user themselves (GET /auth/me, PATCH /auth/me/profile); `api` decides
    // who else may see them (#288).
    bio: {
        type: String,
        default: null,
    },
    instagram: {
        type: String,
        default: null,
    },
    telegram: {
        type: String,
        default: null,
    },
},
    {
        timestamps: true,
    }
);

export const User = model("User", userSchema);
