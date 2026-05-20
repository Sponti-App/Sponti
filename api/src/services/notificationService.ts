import { Types, type ClientSession } from "mongoose";
import {
  EventMember,
  Notification,
  type NotificationTargetType,
  type NotificationType,
} from "#models/index";
import type {
  GetNotificationsQuery,
  ReadNotificationsBatchBody,
} from "#schemas/notificationSchemas";
import { getUsersByIds, type UserSummary } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId, uniqueObjectIdStrings } from "#utils/objectId";

type Cursor = {
  createdAt: Date;
  id: Types.ObjectId;
};

type NotificationLeanDocument = {
  _id: unknown;
  userId: unknown;
  actorId?: unknown | null;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetId: unknown;
  title: string;
  message: string;
  readAt?: Date | string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type NotificationDto = {
  _id: string;
  userId: string;
  actorId: string | null;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetId: string;
  title: string;
  message: string;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  actor: UserSummary | null;
};

type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetId: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type CreateEventStatusNotificationsInput = {
  eventId: string;
  hostId: string;
  eventTitle: string;
  type: Extract<NotificationType, "event_cancelled" | "event_reactivated">;
  session?: ClientSession;
};

const RELEVANT_EVENT_STATUS_RSVPS = ["invited", "going"] as const;

const toIso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const actorDisplayName = (actor: UserSummary | undefined, fallback = "Someone") =>
  actor?.displayName || actor?.username || fallback;

const encodeCursor = (doc: NotificationLeanDocument) =>
  Buffer.from(
    JSON.stringify({
      createdAt: toIso(doc.createdAt),
      id: String(doc._id),
    })
  ).toString("base64url");

const decodeCursor = (cursor: string): Cursor => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };

    if (typeof decoded.createdAt !== "string" || typeof decoded.id !== "string") {
      throw new Error("Invalid cursor payload");
    }

    const createdAt = new Date(decoded.createdAt);

    if (Number.isNaN(createdAt.getTime()) || !Types.ObjectId.isValid(decoded.id)) {
      throw new Error("Invalid cursor values");
    }

    return {
      createdAt,
      id: toObjectId(decoded.id),
    };
  } catch {
    throw new AppError("Invalid notification cursor", 400, "INVALID_NOTIFICATION_CURSOR");
  }
};

const toNotificationDto = (
  notification: NotificationLeanDocument,
  actorsById: Map<string, UserSummary>
): NotificationDto => {
  const actorId = notification.actorId ? String(notification.actorId) : null;

  return {
    _id: String(notification._id),
    userId: String(notification.userId),
    actorId,
    type: notification.type,
    targetType: notification.targetType,
    targetId: String(notification.targetId),
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt ? toIso(notification.readAt) : null,
    metadata: notification.metadata ?? {},
    createdAt: toIso(notification.createdAt),
    updatedAt: toIso(notification.updatedAt),
    actor: actorId ? (actorsById.get(actorId) ?? null) : null,
  };
};

const createNotifications = async (inputs: CreateNotificationInput[], session?: ClientSession) => {
  if (inputs.length === 0) {
    return { created: 0 };
  }

  const docs = inputs.map((input) => ({
    userId: toObjectId(input.userId),
    actorId: input.actorId ? toObjectId(input.actorId) : null,
    type: input.type,
    targetType: input.targetType,
    targetId: toObjectId(input.targetId),
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
  }));

  const created = await Notification.create(docs, { session });

  return { created: created.length };
};

const createMissingRecipientNotifications = async ({
  recipientIds,
  actorId,
  type,
  targetType,
  targetId,
  build,
  session,
}: {
  recipientIds: string[];
  actorId?: string | null;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetId: string;
  build: (recipientId: string) => Pick<CreateNotificationInput, "title" | "message" | "metadata">;
  session?: ClientSession;
}) => {
  const recipients = uniqueObjectIdStrings(recipientIds);

  if (recipients.length === 0) {
    return { created: 0 };
  }

  const existing = (await Notification.find({
    userId: { $in: recipients.map(toObjectId) },
    type,
    targetType,
    targetId: toObjectId(targetId),
  })
    .select("userId")
    .session(session ?? null)
    .lean()) as Array<{ userId: unknown }>;
  const existingRecipientIds = new Set(existing.map((doc) => String(doc.userId)));
  const inputs = recipients
    .filter((recipientId) => !existingRecipientIds.has(recipientId))
    .map((recipientId) => ({
      userId: recipientId,
      actorId,
      type,
      targetType,
      targetId,
      ...build(recipientId),
    }));

  return createNotifications(inputs, session);
};

export const getNotifications = async (userId: string, query: GetNotificationsQuery) => {
  const filter: Record<string, unknown> = {
    userId: toObjectId(userId),
  };

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }

  const docs = (await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean()) as NotificationLeanDocument[];
  const page = docs.slice(0, query.limit);
  const actorIds = page
    .map((notification) => (notification.actorId ? String(notification.actorId) : null))
    .filter((actorId): actorId is string => Boolean(actorId));
  const actorsById = await getUsersByIds(actorIds);
  const lastNotification = page.at(-1);
  const nextCursor =
    docs.length > query.limit && lastNotification ? encodeCursor(lastNotification) : null;

  return {
    data: page.map((notification) => toNotificationDto(notification, actorsById)),
    pagination: {
      nextCursor,
    },
  };
};

export const getUnreadCount = async (userId: string) => {
  const count = await Notification.countDocuments({
    userId: toObjectId(userId),
    readAt: null,
  });

  return { count };
};

export const markNotificationsReadBatch = async (
  userId: string,
  input: ReadNotificationsBatchBody
) => {
  const notificationIds = uniqueObjectIdStrings(input.notificationIds);

  const result = await Notification.updateMany(
    {
      _id: { $in: notificationIds.map(toObjectId) },
      userId: toObjectId(userId),
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    }
  );
  const { count: unreadCount } = await getUnreadCount(userId);

  return {
    markedRead: result.modifiedCount,
    unreadCount,
  };
};

export const createConnectionRequestNotification = async ({
  requesterId,
  receiverId,
  connectionId,
  session,
}: {
  requesterId: string;
  receiverId: string;
  connectionId: string;
  session?: ClientSession;
}) => {
  const users = await getUsersByIds([requesterId]);
  const requester = users.get(requesterId);
  const requesterName = actorDisplayName(requester, "Someone");

  return createMissingRecipientNotifications({
    recipientIds: [receiverId],
    actorId: requesterId,
    type: "connection_request",
    targetType: "connection",
    targetId: connectionId,
    session,
    build: () => ({
      title: `${requesterName} wants to connect`,
      message: "Tap to respond to the request.",
      metadata: {
        actorUsername: requester?.username,
      },
    }),
  });
};

export const createConnectionAcceptedNotification = async ({
  requesterId,
  accepterId,
  connectionId,
  session,
}: {
  requesterId: string;
  accepterId: string;
  connectionId: string;
  session?: ClientSession;
}) => {
  const users = await getUsersByIds([accepterId]);
  const accepter = users.get(accepterId);
  const accepterName = actorDisplayName(accepter, "Someone");
  const circleHint = accepter?.username
    ? `Now you can add @${accepter.username} to a circle.`
    : "Now you can add them to a circle.";

  return createMissingRecipientNotifications({
    recipientIds: [requesterId],
    actorId: accepterId,
    type: "connection_accepted",
    targetType: "connection",
    targetId: connectionId,
    session,
    build: () => ({
      title: `${accepterName} accepted your request`,
      message: circleHint,
      metadata: {
        actorUsername: accepter?.username,
      },
    }),
  });
};

export const createEventInvitationNotifications = async ({
  eventId,
  hostId,
  eventTitle,
  inviteeIds,
  session,
}: {
  eventId: string;
  hostId: string;
  eventTitle: string;
  inviteeIds: string[];
  session?: ClientSession;
}) => {
  const users = await getUsersByIds([hostId]);
  const host = users.get(hostId);
  const hostName = actorDisplayName(host, "Someone");
  const recipientIds = uniqueObjectIdStrings(inviteeIds).filter(
    (inviteeId) => inviteeId !== hostId
  );

  return createMissingRecipientNotifications({
    recipientIds,
    actorId: hostId,
    type: "event_invitation",
    targetType: "event",
    targetId: eventId,
    session,
    build: () => ({
      title: `${hostName} invited you`,
      message: `to ${eventTitle}`,
      metadata: {
        eventTitle,
      },
    }),
  });
};

export const createEventRsvpChangeNotification = async ({
  eventId,
  hostId,
  attendeeId,
  eventTitle,
  rsvpStatus,
  session,
}: {
  eventId: string;
  hostId: string;
  attendeeId: string;
  eventTitle: string;
  rsvpStatus: "going" | "declined";
  session?: ClientSession;
}) => {
  if (hostId === attendeeId) {
    return { created: 0 };
  }

  const users = await getUsersByIds([attendeeId]);
  const attendee = users.get(attendeeId);
  const attendeeName = actorDisplayName(attendee, "Someone");
  const rsvpLabel = rsvpStatus === "going" ? "is going to" : "can't make it to";

  return createNotifications(
    [
      {
        userId: hostId,
        actorId: attendeeId,
        type: "event_rsvp_change",
        targetType: "event",
        targetId: eventId,
        title: `${attendeeName} updated their RSVP`,
        message: `${attendeeName} ${rsvpLabel} ${eventTitle}.`,
        metadata: {
          eventTitle,
          rsvpStatus,
        },
      },
    ],
    session
  );
};

export const createEventStatusNotifications = async ({
  eventId,
  hostId,
  eventTitle,
  type,
  session,
}: CreateEventStatusNotificationsInput) => {
  const eventObjectId = toObjectId(eventId);
  const hostObjectId = toObjectId(hostId);
  const members = (await EventMember.find({
    eventId: eventObjectId,
    rsvpStatus: { $in: RELEVANT_EVENT_STATUS_RSVPS },
  })
    .select("userId rsvpStatus")
    .session(session ?? null)
    .lean()) as Array<{ userId: unknown; rsvpStatus: string }>;
  const recipients = members.filter(
    (member) =>
      String(member.userId) !== hostId &&
      RELEVANT_EVENT_STATUS_RSVPS.includes(
        member.rsvpStatus as (typeof RELEVANT_EVENT_STATUS_RSVPS)[number]
      )
  );

  if (recipients.length === 0) {
    return { created: 0 };
  }

  const isCancellation = type === "event_cancelled";
  const title = isCancellation ? "Event cancelled" : "Event reactivated";
  const message = isCancellation
    ? `${eventTitle} was cancelled.`
    : `${eventTitle} was reactivated.`;

  return createNotifications(
    recipients.map((member) => ({
      userId: String(member.userId),
      actorId: hostObjectId.toString(),
      type,
      targetType: "event",
      targetId: eventObjectId.toString(),
      title,
      message,
      metadata: {
        eventTitle,
      },
    })),
    session
  );
};
