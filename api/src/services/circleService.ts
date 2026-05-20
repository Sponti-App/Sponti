import { type ClientSession } from "mongoose";
import { Circle, CircleMember, Connection } from "#models/index";
import type {
  AddCircleMemberBody,
  CreateCircleBody,
  UpdateCircleBody,
} from "#schemas/circleSchemas";
import { AppError } from "#utils/AppError";
import { toObjectId, uniqueObjectIdStrings } from "#utils/objectId";
import { getUsersByIds } from "#services/userDirectoryService";
import { withTransactionFallback } from "#utils/transactions";

const circleNameCollation = { locale: "en", strength: 2 } as const;

const assertUniqueCircleName = async (ownerId: string, name: string, exceptCircleId?: string) => {
  const filter: Record<string, unknown> = {
    ownerId: toObjectId(ownerId),
    name,
  };

  if (exceptCircleId) {
    filter._id = { $ne: toObjectId(exceptCircleId) };
  }

  const existing = await Circle.findOne(filter).collation(circleNameCollation).select("_id").lean();

  if (existing) {
    throw new AppError("A circle with this name already exists", 409, "CIRCLE_NAME_EXISTS");
  }
};

const assertAcceptedConnectionMembers = async (ownerId: string, memberIds: string[]) => {
  const uniqueMemberIds = uniqueObjectIdStrings(memberIds);

  if (uniqueMemberIds.length === 0) {
    return;
  }

  if (uniqueMemberIds.includes(ownerId)) {
    throw new AppError("You cannot add yourself to your own circle", 400, "CANNOT_ADD_SELF");
  }

  const ownerObjectId = toObjectId(ownerId);
  const memberObjectIds = uniqueMemberIds.map(toObjectId);
  const connections = await Connection.find({
    status: "accepted",
    $or: [
      { requesterId: ownerObjectId, receiverId: { $in: memberObjectIds } },
      { receiverId: ownerObjectId, requesterId: { $in: memberObjectIds } },
    ],
  })
    .select("requesterId receiverId")
    .lean();
  const acceptedUserIds = new Set<string>();

  for (const connection of connections) {
    const requesterId = connection.requesterId.toString();
    const receiverId = connection.receiverId.toString();
    acceptedUserIds.add(requesterId === ownerId ? receiverId : requesterId);
  }

  const missingMember = uniqueMemberIds.find((memberId) => !acceptedUserIds.has(memberId));

  if (missingMember) {
    throw new AppError(
      "Only accepted connections can be added to circles",
      403,
      "CIRCLE_MEMBER_NOT_ACCEPTED_CONNECTION"
    );
  }
};

export const getMyCircles = async (ownerId: string) => {
  const ownerObjectId = toObjectId(ownerId);
  const circles = await Circle.find({ ownerId: ownerObjectId }).sort({ createdAt: 1 }).lean();
  const circleIds = circles.map((circle) => circle._id);
  const members = await CircleMember.find({ ownerId: ownerObjectId, circleId: { $in: circleIds } })
    .sort({ createdAt: 1 })
    .lean();
  const users = await getUsersByIds(members.map((member) => member.userId.toString()));
  const membersByCircle = new Map<string, typeof members>();

  for (const member of members) {
    const circleId = member.circleId.toString();
    const existing = membersByCircle.get(circleId) ?? [];
    existing.push(member);
    membersByCircle.set(circleId, existing);
  }

  return circles.map((circle) => ({
    ...circle,
    members: (membersByCircle.get(circle._id.toString()) ?? []).map((member) => ({
      ...member,
      user: users.get(member.userId.toString()) ?? null,
    })),
  }));
};

export const createCircle = async (ownerId: string, input: CreateCircleBody) => {
  const memberIds = uniqueObjectIdStrings(input.memberIds);

  await assertUniqueCircleName(ownerId, input.name);
  await assertAcceptedConnectionMembers(ownerId, memberIds);

  const ownerObjectId = toObjectId(ownerId);
  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const [circle] = await Circle.create(
      [
        {
          ownerId: ownerObjectId,
          name: input.name,
          color: input.color ?? null,
          type: input.type,
          icon: input.icon ?? null,
        },
      ],
      { session }
    );

    if (!circle) {
      throw new AppError("Circle could not be created", 500, "CIRCLE_CREATE_FAILED");
    }

    const members =
      memberIds.length > 0
        ? await CircleMember.create(
            memberIds.map((memberId) => ({
              circleId: circle._id,
              ownerId: ownerObjectId,
              userId: toObjectId(memberId),
            })),
            { session, ordered: true }
          )
        : [];

    return { circle, members };
  });
  const users = await getUsersByIds(result.members.map((member) => member.userId.toString()));

  return {
    ...result.circle.toObject(),
    members: result.members.map((member) => ({
      ...member.toObject(),
      user: users.get(member.userId.toString()) ?? null,
    })),
  };
};

export const updateCircle = async (ownerId: string, circleId: string, input: UpdateCircleBody) => {
  if (input.name) {
    await assertUniqueCircleName(ownerId, input.name, circleId);
  }

  const circle = await Circle.findOneAndUpdate(
    { _id: toObjectId(circleId), ownerId: toObjectId(ownerId) },
    { $set: input },
    { new: true, runValidators: true }
  ).lean();

  if (!circle) {
    throw new AppError("Circle not found", 404, "CIRCLE_NOT_FOUND");
  }

  return circle;
};

export const addCircleMember = async (
  ownerId: string,
  circleId: string,
  input: AddCircleMemberBody
) => {
  if (ownerId === input.userId) {
    throw new AppError("You cannot add yourself to your own circle", 400, "CANNOT_ADD_SELF");
  }

  const ownerObjectId = toObjectId(ownerId);
  const circle = await Circle.findOne({ _id: toObjectId(circleId), ownerId: ownerObjectId }).lean();

  if (!circle) {
    throw new AppError("Circle not found", 404, "CIRCLE_NOT_FOUND");
  }

  await assertAcceptedConnectionMembers(ownerId, [input.userId]);

  return CircleMember.create({
    circleId: circle._id,
    ownerId: ownerObjectId,
    userId: toObjectId(input.userId),
  });
};

export const removeCircleMember = async (ownerId: string, circleId: string, userId: string) => {
  const result = await CircleMember.deleteOne({
    circleId: toObjectId(circleId),
    ownerId: toObjectId(ownerId),
    userId: toObjectId(userId),
  });

  if (result.deletedCount === 0) {
    throw new AppError("Circle member not found", 404, "CIRCLE_MEMBER_NOT_FOUND");
  }
};
