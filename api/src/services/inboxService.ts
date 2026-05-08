import { Connection, EventMember } from "#models/index";
import { getBlockedRelationshipUserIds } from "#services/blockService";
import { toObjectId } from "#utils/objectId";

export const getMyInbox = async (userId: string) => {
  const userObjectId = toObjectId(userId);
  const blockedObjectIds = (await getBlockedRelationshipUserIds(userId)).map(toObjectId);

  const [connectionRequests, eventInvitations] = await Promise.all([
    Connection.aggregate([
      {
        $match: {
          receiverId: userObjectId,
          status: "pending",
          requesterId: { $nin: blockedObjectIds },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "requesterId",
          foreignField: "_id",
          as: "requester",
        },
      },
      { $unwind: { path: "$requester", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          requesterId: 1,
          receiverId: 1,
          status: 1,
          type: 1,
          createdAt: 1,
          updatedAt: 1,
          requester: {
            _id: "$requester._id",
            username: "$requester.username",
            displayName: "$requester.displayName",
            avatarUrl: "$requester.avatarUrl",
            profileVisibility: "$requester.profileVisibility",
            socialBattery: "$requester.socialBattery",
          },
        },
      },
    ]),
    EventMember.aggregate([
      {
        $match: {
          userId: userObjectId,
          rsvpStatus: "invited",
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "eventId",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },
      {
        $match: {
          "event.status": "active",
          "event.hostId": { $nin: blockedObjectIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          eventId: 1,
          userId: 1,
          invitedBy: 1,
          role: 1,
          rsvpStatus: 1,
          canInviteGuests: 1,
          memberWillArriveAt: 1,
          createdAt: 1,
          updatedAt: 1,
          event: {
            _id: "$event._id",
            title: "$event.title",
            startAt: "$event.startAt",
            endAt: "$event.endAt",
            locationName: "$event.locationName",
            locationAddress: "$event.locationAddress",
            visibility: "$event.visibility",
            status: "$event.status",
            hostId: "$event.hostId",
          },
        },
      },
    ]),
  ]);

  return {
    connectionRequests,
    eventInvitations,
  };
};
