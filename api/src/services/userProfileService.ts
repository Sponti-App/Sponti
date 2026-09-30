import { getRelationship, type Relationship } from "#services/relationshipService";
import { getUserIdentityByUsername } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";

// How the viewer stands with the person whose profile they opened, from the
// shared relationship function (#267). "blocked" here only ever means the
// viewer blocked them: being blocked by them is a 404.
export type ProfileRelationship = Relationship;

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// One error for "no such user" and "that user blocked you", so a profile
// lookup can't tell a blocked viewer anything an unknown username wouldn't.
const notFound = () => new AppError("User not found", 404, "USER_NOT_FOUND");

type ProfileView = {
  profile: PublicProfile;
  relationship: ProfileRelationship;
  // The pending request, so the viewer can cancel (outgoing) or accept
  // (incoming) it. Null for every other relationship.
  connectionId: string | null;
};

/**
 * Someone else's profile, opened by username (#199): the host link on a
 * flare, a circles row, a typed URL. Profile visibility is discovery-only
 * (see auth-server CONTEXT.md), so it only ever affects search, never this:
 * anyone signed in who has the username sees the same public identity
 * (display name, @username, avatar) whether the profile is public or private.
 * Nothing else about the user is returned.
 *
 * - The viewer blocked them: identity + "blocked", so they can unblock.
 * - They blocked the viewer: 404, the same as an unknown username.
 */
export const getProfileByUsername = async (
  viewerId: string,
  username: string
): Promise<ProfileView> => {
  const user = await getUserIdentityByUsername(username);
  if (!user) throw notFound();

  const profile: PublicProfile = {
    id: user._id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl ?? null,
  };

  const { relationship, blockedBy, connectionId } = await getRelationship(viewerId, user._id);

  if (relationship === "blocked" && blockedBy === "other") throw notFound();

  return { profile, relationship, connectionId };
};
