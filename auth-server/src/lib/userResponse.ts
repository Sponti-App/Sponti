import type { User } from "#models";

type UserDocument = InstanceType<typeof User>;

// The account fields of a user. It leaves out the self-authored profile fields
// (bio, handles) on purpose, so anything that is not the user's own session or
// own record (another user's data, a list row) must start from this and never
// from toOwnProfileResponse. The user's own responses use toOwnProfileResponse.
export const toUserResponse = (user: UserDocument) => ({
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    avatarPublicId: user.avatarPublicId,
    profileVisibility: user.profileVisibility,
    socialBattery: user.socialBattery,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

// The signed-in user's own record, bio and handles included. Every response
// that hands the user their own session returns this one shape: register, login
// and Google sign-in (via createSessionResponse), GET /auth/me and
// PATCH /auth/me/profile. Never use it for anyone else's data.
export const toOwnProfileResponse = (user: UserDocument) => ({
    ...toUserResponse(user),
    bio: user.bio ?? null,
    instagram: user.instagram ?? null,
    telegram: user.telegram ?? null,
});
