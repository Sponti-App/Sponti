import { Circle, CircleMember, Connection } from "#models/index";
import type { AddCircleMemberBody, UpdateCircleBody } from "#schemas/circleSchemas";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";
import { getUsersByIds } from "#services/userDirectoryService";

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

export const updateCircle = async (ownerId: string, circleId: string, input: UpdateCircleBody) => {
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
  const userObjectId = toObjectId(input.userId);
  const circle = await Circle.findOne({ _id: toObjectId(circleId), ownerId: ownerObjectId }).lean();

  if (!circle) {
    throw new AppError("Circle not found", 404, "CIRCLE_NOT_FOUND");
  }

  const acceptedConnection = await Connection.exists({
    requesterId: ownerObjectId,
    receiverId: userObjectId,
    status: "accepted",
  });

  if (!acceptedConnection) {
    throw new AppError(
      "Only accepted connections can be added to circles",
      403,
      "CIRCLE_MEMBER_NOT_ACCEPTED_CONNECTION"
    );
  }

  return CircleMember.create({
    circleId: circle._id,
    ownerId: ownerObjectId,
    userId: userObjectId,
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
