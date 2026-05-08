import { type ClientSession } from "mongoose";
import { Block, CircleMember, Connection } from "#models/index";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";
import { withTransactionFallback } from "#utils/transactions";
import { getUsersByIds } from "#services/userDirectoryService";

export const getBlockedRelationshipUserIds = async (userId: string) => {
  const userObjectId = toObjectId(userId);
  const blocks = await Block.find({
    $or: [{ blockerId: userObjectId }, { blockedId: userObjectId }],
  })
    .select("blockerId blockedId")
    .lean();

  return blocks.map((block) => {
    const blockerId = block.blockerId.toString();
    const blockedId = block.blockedId.toString();

    return blockerId === userId ? blockedId : blockerId;
  });
};

export const hasAnyBlockBetweenUsers = async (userA: string, userB: string) => {
  const userAObjectId = toObjectId(userA);
  const userBObjectId = toObjectId(userB);

  const block = await Block.exists({
    $or: [
      { blockerId: userAObjectId, blockedId: userBObjectId },
      { blockerId: userBObjectId, blockedId: userAObjectId },
    ],
  });

  return Boolean(block);
};

export const hasRecipientBlockedSender = async (senderId: string, recipientId: string) => {
  const block = await Block.exists({
    blockerId: toObjectId(recipientId),
    blockedId: toObjectId(senderId),
  });

  return Boolean(block);
};

export const getBlockedInviteeIds = async (actorId: string, candidateUserIds: string[]) => {
  if (candidateUserIds.length === 0) {
    return new Set<string>();
  }

  const actorObjectId = toObjectId(actorId);
  const candidateObjectIds = candidateUserIds.map(toObjectId);
  const blocks = await Block.find({
    $or: [
      { blockerId: actorObjectId, blockedId: { $in: candidateObjectIds } },
      { blockerId: { $in: candidateObjectIds }, blockedId: actorObjectId },
    ],
  })
    .select("blockerId blockedId")
    .lean();

  const blocked = new Set<string>();

  for (const block of blocks) {
    const blockerId = block.blockerId.toString();
    const blockedId = block.blockedId.toString();

    blocked.add(blockerId === actorId ? blockedId : blockerId);
  }

  return blocked;
};

export const blockUser = async (blockerId: string, blockedId: string) => {
  if (blockerId === blockedId) {
    throw new AppError("You cannot block yourself", 400, "CANNOT_BLOCK_SELF");
  }

  const blockerObjectId = toObjectId(blockerId);
  const blockedObjectId = toObjectId(blockedId);

  await withTransactionFallback(async (session?: ClientSession) => {
    await Block.updateOne(
      { blockerId: blockerObjectId, blockedId: blockedObjectId },
      { $setOnInsert: { blockerId: blockerObjectId, blockedId: blockedObjectId } },
      { upsert: true, session }
    );

    await Connection.deleteMany(
      {
        $or: [
          { requesterId: blockerObjectId, receiverId: blockedObjectId },
          { requesterId: blockedObjectId, receiverId: blockerObjectId, status: "pending" },
        ],
      },
      { session }
    );

    await CircleMember.deleteMany(
      { ownerId: blockerObjectId, userId: blockedObjectId },
      { session }
    );
  });

  return Block.findOne({ blockerId: blockerObjectId, blockedId: blockedObjectId }).lean();
};

export const unblockUser = async (blockerId: string, blockedId: string) => {
  if (blockerId === blockedId) {
    throw new AppError("You cannot unblock yourself", 400, "CANNOT_UNBLOCK_SELF");
  }

  const result = await Block.deleteOne({
    blockerId: toObjectId(blockerId),
    blockedId: toObjectId(blockedId),
  });

  if (result.deletedCount === 0) {
    throw new AppError("Block not found", 404, "BLOCK_NOT_FOUND");
  }
};

export const getBlockedUsers = async (blockerId: string) => {
  const blocks = await Block.find({ blockerId: toObjectId(blockerId) }).lean();
  const users = await getUsersByIds(blocks.map((block) => block.blockedId.toString()));

  return blocks.map((block) => ({
    ...block,
    blockedUser: users.get(block.blockedId.toString()) ?? null,
  }));
};
