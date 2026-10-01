import type { User } from "#models";

type UserDocument = InstanceType<typeof User>;

// The user object in session responses (register, login, Google sign-in).
// Deliberately excludes the self-authored profile fields (bio, handles): they
// are only returned by the endpoints below, which serve the user's own record.
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

// The signed-in user's own record: GET /auth/me and PATCH /auth/me/profile.
export const toOwnProfileResponse = (user: UserDocument) => ({
    ...toUserResponse(user),
    bio: user.bio ?? null,
    instagram: user.instagram ?? null,
    telegram: user.telegram ?? null,
});
