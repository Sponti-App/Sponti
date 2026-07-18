import mongoose from "mongoose";
import { Connection } from "#models/index";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";
import { getBlockedRelationshipUserIds } from "#services/blockService";
import type { SearchUsersQuery } from "#schemas/userSearchSchemas";

export type UserSummary = {
  _id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  profileVisibility?: "public" | "private";
  socialBattery?: number;
};

const getUsersCollection = () => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new AppError("MongoDB is not connected", 500, "DATABASE_NOT_CONNECTED");
  }

  return db.collection("users");
};

const userProjection = {
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

const getAcceptedConnectionIds = async (userId: string) => {
  const userObjectId = toObjectId(userId);
  const connections = await Connection.find({
    $or: [{ requesterId: userObjectId }, { receiverId: userObjectId }],
    status: "accepted",
  })
    .select("requesterId receiverId")
    .lean();

  return connections.map((c) => {
    const rid = c.requesterId.toString();
    return rid === userId ? c.receiverId : c.requesterId;
  });
};

export const searchUsers = async (requesterId: string, query: SearchUsersQuery) => {
  const [blockedIds, connectedIds] = await Promise.all([
    getBlockedRelationshipUserIds(requesterId),
    getAcceptedConnectionIds(requesterId),
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
            { _id: { $in: connectedIds } },
            ...(isExactUsername ? [{ username: new RegExp(`^${escapeRegex(query.q)}$`, "i") }] : []),
          ],
        },
      ],
    })
    .project(userProjection)
    .limit(query.limit)
    .toArray();

  return users.map(toUserSummary);
};
