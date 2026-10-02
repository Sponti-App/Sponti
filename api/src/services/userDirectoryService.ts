import mongoose from "mongoose";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";
import { getBlockedRelationshipUserIds } from "#services/blockService";
import { getConnectedUserIds } from "#services/relationshipService";
import type { SearchUsersQuery } from "#schemas/userSearchSchemas";

export type UserSummary = {
  _id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  profileVisibility?: "public" | "private";
  socialBattery?: number;
};

export const getUsersCollection = () => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new AppError("MongoDB is not connected", 500, "DATABASE_NOT_CONNECTED");
  }

  return db.collection("users");
};

// The user fields every other api path (search, events, connections, blocks,
// notifications, circles, QR and invite links) gets about another user. Never
// add bio or social handles here: this feeds strangers too (every flare
// payload). Those are read only by userProfileService, behind its visibility
// gate (#288); a regression test checks every consumer.
export const userProjection = {
  username: 1,
  displayName: 1,
  avatarUrl: 1,
  profileVisibility: 1,
  socialBattery: 1,
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toUserSummary = (user: Record<string, any>): UserSummary => ({
  _id: user._id.toString(),
  username: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl ?? null,
  profileVisibility: user.profileVisibility,
  socialBattery: user.socialBattery,
});

export const getUsersByIds = async (userIds: string[]) => {
  const uniqueIds = Array.from(new Set(userIds));
  const result = new Map<string, UserSummary>();

  if (uniqueIds.length === 0) {
    return result;
  }

  const users = await getUsersCollection()
    .find({ _id: { $in: uniqueIds.map(toObjectId) } })
    .project(userProjection)
    .toArray();

  for (const user of users) {
    result.set(user._id.toString(), toUserSummary(user));
  }

  return result;
};

export const searchUsers = async (requesterId: string, query: SearchUsersQuery) => {
  const [blockedIds, connectedIds] = await Promise.all([
    getBlockedRelationshipUserIds(requesterId),
    getConnectedUserIds(requesterId),
  ]);
  const excludedIds = [requesterId, ...blockedIds].map(toObjectId);
  const regex = new RegExp(escapeRegex(query.q), "i");
  const isExactUsername = /^[a-zA-Z0-9._-]+$/.test(query.q);

  const users = await getUsersCollection()
    .find({
      _id: { $nin: excludedIds },
      $or: [{ username: regex }, { displayName: regex }],
      $and: [
        {
          $or: [
            { profileVisibility: { $ne: "private" } },
            { _id: { $in: Array.from(connectedIds, toObjectId) } },
            ...(isExactUsername
              ? [{ username: new RegExp(`^${escapeRegex(query.q)}$`, "i") }]
              : []),
          ],
        },
      ],
    })
    .project(userProjection)
    .limit(query.limit)
    .toArray();

  return users.map(toUserSummary);
};
