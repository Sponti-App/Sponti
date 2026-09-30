import {
  getConnectedUserIds,
  getRelationship,
  type Relationship,
  type RelationshipView,
} from "#services/relationshipService";
import { getUsersCollection } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";
import { toPagination } from "#utils/pagination";

// How the viewer stands with the person whose profile they opened, from the
// shared relationship function (#267). "blocked" here only ever means the
// viewer blocked them: being blocked by them is a 404.
export type ProfileRelationship = Relationship;

// Who someone is: what every signed-in viewer who isn't blocked gets.
export type ProfileIdentity = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ProfileSocials = {
  instagram: string | null;
  telegram: string | null;
};

export type PublicProfile = ProfileIdentity & {
  bio: string | null;
  socials: ProfileSocials;
};

export type MutualFriends = {
  count: number;
  preview: ProfileIdentity[];
};

type ProfileView = {
  profile: PublicProfile;
  relationship: ProfileRelationship;
  // The pending request, so the viewer can cancel (outgoing) or accept
  // (incoming) it. Null for every other relationship.
  connectionId: string | null;
  mutualFriends: MutualFriends;
};

export const MUTUAL_FRIENDS_PREVIEW_SIZE = 3;

// bio, instagram and telegram are written by auth-server (#287) on the shared
// users collection. This file is the only place in api that reads them: they
// are selected here, explicitly, and never through `userProjection` /
// `getUsersByIds`, which feed search, flares and notifications to strangers.
const PROFILE_OWNER_PROJECTION = {
  username: 1,
  displayName: 1,
  avatarUrl: 1,
  profileVisibility: 1,
  bio: 1,
  instagram: 1,
  telegram: 1,
} as const;

// A raw users document, as projected above (api has no User model).
type StoredUser = Record<string, any>;

const IDENTITY_PROJECTION = { username: 1, displayName: 1, avatarUrl: 1 } as const;

// One error for "no such user" and "that user blocked you", so a profile
// lookup can't tell a blocked viewer anything an unknown username wouldn't.
const notFound = () => new AppError("User not found", 404, "USER_NOT_FOUND");

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const toIdentity = (user: StoredUser): ProfileIdentity => ({
  id: user._id.toString(),
  username: user.username,
  displayName: user.displayName || user.username,
  avatarUrl: user.avatarUrl ?? null,
});

const noMutualFriends = (): MutualFriends => ({ count: 0, preview: [] });

/**
 * What the viewer may see beyond identity (#166, final table):
 * - "full": bio, socials and mutual friends.
 * - "identity": name, @username and photo only.
 *
 * self and connected: full. The viewer blocked them: identity (plus unblock).
 * Anyone else signed in (a stranger, or a pending request either way): full
 * on a public profile, identity on a private one. "They blocked the viewer"
 * never gets here: it is a 404 before this is asked.
 */
type ProfileAccess = "full" | "identity";

const resolveAccess = (relationship: Relationship, profileVisibility: unknown): ProfileAccess => {
  switch (relationship) {
    case "self":
    case "connected":
      return "full";
    case "blocked":
      return "identity";
    default:
      // A missing visibility reads as public, the same as search does.
      return profileVisibility === "private" ? "identity" : "full";
  }
};

type ResolvedProfile = {
  owner: StoredUser;
  ownerId: string;
  relationship: RelationshipView;
  access: ProfileAccess;
};

const resolveProfile = async (viewerId: string, username: string): Promise<ResolvedProfile> => {
  const owner = await getUsersCollection().findOne(
    { username },
    { projection: PROFILE_OWNER_PROJECTION }
  );
  if (!owner) throw notFound();

  const ownerId = owner._id.toString();
  const relationship = await getRelationship(viewerId, ownerId);

  if (relationship.relationship === "blocked" && relationship.blockedBy === "other") {
    throw notFound();
  }

  return {
    owner,
    ownerId,
    relationship,
    access: resolveAccess(relationship.relationship, owner.profileVisibility),
  };
};

// Mutual friends are only worked out when the viewer may see them, and never
// on your own profile (everyone you know would be "mutual" with yourself).
const showsMutualFriends = ({ access, relationship }: ResolvedProfile) =>
  access === "full" && relationship.relationship !== "self";

/**
 * People connected to both the viewer and the owner, by the shared definition
 * (#267: accepted both ways, no block either way). Because each side's
 * connections already exclude anyone in a block with that side, a friend who
 * blocked the viewer (or whom the viewer blocked) never shows up here, and
 * neither does one in a block with the owner.
 *
 * The owner's full network is never loaded: their side is only checked
 * against the viewer's connections. Six queries (three per side), whatever the
 * size of either network (see API_RULES.md, Profile).
 */
const getMutualFriendIds = async (viewerId: string, ownerId: string) => {
  const viewerConnections = await getConnectedUserIds(viewerId);
  viewerConnections.delete(ownerId);
  viewerConnections.delete(viewerId);

  if (viewerConnections.size === 0) {
    return [];
  }

  const mutual = await getConnectedUserIds(ownerId, Array.from(viewerConnections));
  mutual.delete(viewerId);
  mutual.delete(ownerId);

  return Array.from(mutual);
};

// Identities for a page of mutual friends, in name order, plus how many of
// them still have an account (so count, preview and the list always agree).
const findMutualFriendIdentities = async (
  mutualIds: string[],
  { skip, limit }: { skip: number; limit: number }
) => {
  if (mutualIds.length === 0) {
    return { identities: [] as ProfileIdentity[], total: 0 };
  }

  const filter = { _id: { $in: mutualIds.map(toObjectId) } };
  const users = getUsersCollection();

  const [page, total] = await Promise.all([
    users
      .find(filter, { projection: IDENTITY_PROJECTION })
      .collation({ locale: "en", strength: 2 })
      .sort({ displayName: 1, username: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    users.countDocuments(filter),
  ]);

  return { identities: page.map(toIdentity), total };
};

/**
 * Someone's profile, opened by username (#199, #288): the host link on a
 * flare, a circles row, a typed URL. What it holds depends on who is looking
 * (the table in API_RULES.md, Profile):
 *
 * - self, or connected: identity, bio, socials, mutual friends.
 * - signed-in stranger: the same on a public profile; identity only on a
 *   private one.
 * - the viewer blocked them: identity + "blocked", so they can unblock.
 * - they blocked the viewer: 404, the same as an unknown username.
 *
 * Every 200 has the same shape. Anything the viewer may not see comes back
 * exactly as a public profile whose owner left it empty (null bio, null
 * handles, zero mutual friends), so the payload never says the profile is
 * private. Email, visibility and every other stored field never leave here.
 */
export const getProfileByUsername = async (
  viewerId: string,
  username: string
): Promise<ProfileView> => {
  const resolved = await resolveProfile(viewerId, username);
  const { owner, ownerId, relationship, access } = resolved;
  const full = access === "full";

  let mutualFriends = noMutualFriends();
  if (showsMutualFriends(resolved)) {
    const mutualIds = await getMutualFriendIds(viewerId, ownerId);
    const { identities, total } = await findMutualFriendIdentities(mutualIds, {
      skip: 0,
      limit: MUTUAL_FRIENDS_PREVIEW_SIZE,
    });
    mutualFriends = { count: total, preview: identities };
  }

  return {
    profile: {
      ...toIdentity(owner),
      bio: full ? optionalText(owner.bio) : null,
      socials: {
        instagram: full ? optionalText(owner.instagram) : null,
        telegram: full ? optionalText(owner.telegram) : null,
      },
    },
    relationship: relationship.relationship,
    connectionId: relationship.connectionId,
    mutualFriends,
  };
};

/**
 * The full mutual friends list behind the count ("tap to list"), a page at a
 * time, in name order. Same gate as the profile: 404 when the profile would
 * be; an empty page wherever the profile shows zero mutual friends because
 * the viewer may not see them (so this can't be used to tell that a profile
 * is private either).
 */
export const getMutualFriendsByUsername = async (
  viewerId: string,
  username: string,
  { page, limit }: { page: number; limit: number }
) => {
  const resolved = await resolveProfile(viewerId, username);

  if (!showsMutualFriends(resolved)) {
    return { data: [] as ProfileIdentity[], pagination: toPagination(page, limit, 0) };
  }

  const mutualIds = await getMutualFriendIds(viewerId, resolved.ownerId);
  const { identities, total } = await findMutualFriendIdentities(mutualIds, {
    skip: (page - 1) * limit,
    limit,
  });

  return { data: identities, pagination: toPagination(page, limit, total) };
};
