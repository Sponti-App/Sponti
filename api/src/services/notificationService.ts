import { Types, type ClientSession } from "mongoose";
import {
  EventMember,
  Notification,
  NotificationSettings,
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

  const created = await Notification.create(docs, { session, ordered: true });

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
  repeat = false,
}: {
  recipientIds: string[];
  actorId?: string | null;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetId: string;
  build: (recipientId: string) => Pick<CreateNotificationInput, "title" | "message" | "metadata">;
  session?: ClientSession;
  // Notify even if the recipient already has this notification (for example
  // someone who was removed from an event and invited again).
  repeat?: boolean;
}) => {
  const recipients = uniqueObjectIdStrings(recipientIds);

  if (recipients.length === 0) {
    return { created: 0 };
  }

  const existing = repeat
    ? []
    : ((await Notification.find({
        userId: { $in: recipients.map(toObjectId) },
        type,
        targetType,
        targetId: toObjectId(targetId),
      })
        .select("userId")
        .session(session ?? null)
        .lean()) as Array<{ userId: unknown }>);
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
    // `null` also matches documents written before the field existed.
    dismissedAt: null,
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
    dismissedAt: null,
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

// #176: "I'm caught up" marks every notification the caller has *right now*
// as read, not just the page the client happens to have loaded (read-batch
// tops out at 10 ids). Scoped to `createdAt <= now` so a notification created
// mid-request (after this handler starts but before the update runs) isn't
// silently marked read before the caller ever sees it.
export const markAllNotificationsRead = async (userId: string) => {
  const now = new Date();

  const result = await Notification.updateMany(
    {
      userId: toObjectId(userId),
      readAt: null,
      createdAt: { $lte: now },
    },
    {
      $set: {
        readAt: now,
      },
    }
  );
  const { count: unreadCount } = await getUnreadCount(userId);

  return {
    markedRead: result.modifiedCount,
    unreadCount,
  };
};

// #173: swiping a feed row away hides it for good. Scoped to the owner — a
// notification id that isn't the caller's is indistinguishable from one that
// doesn't exist. Also marks it read so a hidden row can't hold the badge up.
// Idempotent: dismissing an already-dismissed notification is a no-op success.
export const dismissNotification = async (userId: string, notificationId: string) => {
  const notification = await Notification.findOne({
    _id: toObjectId(notificationId),
    userId: toObjectId(userId),
  });

  if (!notification) {
    throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
  }

  const now = new Date();
  if (!notification.dismissedAt) notification.dismissedAt = now;
  if (!notification.readAt) notification.readAt = now;
  if (notification.isModified()) await notification.save();

  const { count: unreadCount } = await getUnreadCount(userId);

  return {
    _id: String(notification._id),
    dismissedAt: toIso(notification.dismissedAt),
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
  via,
}: {
  requesterId: string;
  accepterId: string;
  connectionId: string;
  session?: ClientSession;
  // "qr": the accepter scanned the recipient's QR code in person, so there
  // was no request to accept (#124) — same notification type, honest copy.
  via?: "qr";
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
      title:
        via === "qr"
          ? `${accepterName} scanned your QR code`
          : `${accepterName} accepted your request`,
      message: via === "qr" ? `You're connected now. ${circleHint}` : circleHint,
      metadata: {
        actorUsername: accepter?.username,
      },
    }),
  });
};

// #91 decision (2026-09-24): the invitation-notification toggle on
// notification_settings must actually gate delivery. This only skips
// *creating the notification* — the EventMember row (and the flare showing
// up for the invitee) is untouched, they just don't get pinged about it.
// A missing settings doc means the schema default, which is enabled — see
// `invitationNotifications` on api/src/models/NotificationSettings.ts.
const filterOutInvitationsOptOuts = async (
  recipientIds: string[],
  session?: ClientSession
): Promise<string[]> => {
  if (recipientIds.length === 0) return recipientIds;

  // Single batched query — not one lookup per invitee.
  const optedOut = (await NotificationSettings.find({
    userId: { $in: recipientIds.map(toObjectId) },
    invitationNotifications: false,
  })
    .select("userId")
    .session(session ?? null)
    .lean()) as Array<{ userId: unknown }>;

  if (optedOut.length === 0) return recipientIds;

  const optedOutIds = new Set(optedOut.map((doc) => String(doc.userId)));
  return recipientIds.filter((recipientId) => !optedOutIds.has(recipientId));
};

export const createEventInvitationNotifications = async ({
  eventId,
  hostId,
  eventTitle,
  inviteeIds,
  session,
  repeat,
}: {
  eventId: string;
  hostId: string;
  eventTitle: string;
  inviteeIds: string[];
  session?: ClientSession;
  repeat?: boolean;
}) => {
  const users = await getUsersByIds([hostId]);
  const host = users.get(hostId);
  const hostName = actorDisplayName(host, "Someone");
  const allRecipientIds = uniqueObjectIdStrings(inviteeIds).filter(
    (inviteeId) => inviteeId !== hostId
  );
  const recipientIds = await filterOutInvitationsOptOuts(allRecipientIds, session);

  return createMissingRecipientNotifications({
    recipientIds,
    actorId: hostId,
    type: "event_invitation",
    targetType: "event",
    targetId: eventId,
    session,
    repeat,
    build: () => ({
      title: `${hostName} invited you`,
      message: `to ${eventTitle}`,
      metadata: {
        eventTitle,
      },
    }),
  });
};

// A relative label ("in about 15 min") rather than a clock time — the api
// has no notion of the host's timezone to render an absolute time correctly
// against, and this matches the "let host know" ETA chip's own vocabulary
// (5 min / 15 min / 30 min / 1 hr), which is duration-based, not clock-based.
const formatEtaLabel = (eta: Date, now: Date = new Date()): string => {
  const minutes = Math.round((eta.getTime() - now.getTime()) / 60_000);
  if (minutes <= 1) return "any minute now";
  if (minutes < 60) return `in about ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours <= 1 ? "in about 1 hr" : `in about ${hours} hrs`;
};

// #211: the near-term "on time" / "running late" answer, offered instead of a
// minute-based ETA while a flare hasn't started but starts within the hour.
const formatArrivalStatusLabel = (status: "on_time" | "running_late"): string =>
  status === "on_time" ? "on time" : "running late";

export const createEventRsvpChangeNotification = async ({
  eventId,
  hostId,
  attendeeId,
  eventTitle,
  rsvpStatus,
  memberWillArriveAt,
  arrivalStatus,
  // Set when the RSVP status itself didn't change and this is only reporting
  // a going member moving their arrival time or status (#90, #211) — distinct
  // copy so the host isn't told someone "RSVP'd" when they didn't.
  etaOnly = false,
  session,
}: {
  eventId: string;
  hostId: string;
  attendeeId: string;
  eventTitle: string;
  rsvpStatus: "going" | "declined";
  memberWillArriveAt?: Date | string | null;
  arrivalStatus?: "on_time" | "running_late" | null;
  etaOnly?: boolean;
  session?: ClientSession;
}) => {
  if (hostId === attendeeId) {
    return { created: 0 };
  }

  const users = await getUsersByIds([attendeeId]);
  const attendee = users.get(attendeeId);
  const attendeeName = actorDisplayName(attendee, "Someone");
  const rsvpLabel = rsvpStatus === "going" ? "is going to" : "can't make it to";
  const eta =
    rsvpStatus === "going" && memberWillArriveAt ? new Date(memberWillArriveAt) : null;
  const etaLabel = eta ? formatEtaLabel(eta) : null;
  const statusLabel =
    rsvpStatus === "going" && arrivalStatus ? formatArrivalStatusLabel(arrivalStatus) : null;

  const title = etaOnly
    ? `${attendeeName} updated their arrival time`
    : `${attendeeName} updated their RSVP`;
  const message = etaOnly
    ? statusLabel
      ? `${attendeeName} is now ${statusLabel} for ${eventTitle}.`
      : `${attendeeName} is now arriving ${etaLabel ?? "soon"} for ${eventTitle}.`
    : statusLabel
      ? `${attendeeName} ${rsvpLabel} ${eventTitle} — ${statusLabel}.`
      : etaLabel
        ? `${attendeeName} ${rsvpLabel} ${eventTitle} — arriving ${etaLabel}.`
        : `${attendeeName} ${rsvpLabel} ${eventTitle}.`;

  return createNotifications(
    [
      {
        userId: hostId,
        actorId: attendeeId,
        type: "event_rsvp_change",
        targetType: "event",
        targetId: eventId,
        title,
        message,
        metadata: {
          eventTitle,
          rsvpStatus,
          memberWillArriveAt: eta ? eta.toISOString() : null,
          arrivalStatus: statusLabel ? arrivalStatus : null,
        },
      },
    ],
    session
  );
};

/**
 * Tells a guest who said they were going that the host took them off the guest
 * list. Deliberately neutral: no actor is attached, so the host isn't named,
 * and there's no reason. Not deduplicated, so a second removal after a
 * re-invite is still reported.
 */
export const createEventGuestRemovedNotification = async ({
  eventId,
  guestId,
  eventTitle,
  session,
}: {
  eventId: string;
  guestId: string;
  eventTitle: string;
  session?: ClientSession;
}) =>
  createNotifications(
    [
      {
        userId: guestId,
        actorId: null,
        type: "event_guest_removed",
        targetType: "event",
        targetId: eventId,
        title: "You're no longer on the guest list",
        message: `for ${eventTitle}`,
        metadata: {
          eventTitle,
        },
      },
    ],
    session
  );

const EVENT_UPDATE_PREVIEW_LENGTH = 120;

const previewText = (text: string, maxLength = EVENT_UPDATE_PREVIEW_LENGTH) => {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= maxLength
    ? collapsed
    : `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
};

/**
 * Tells going guests the host posted an update to the flare's thread (#140).
 * One notification per recipient per update; the caller decides who may
 * receive it (going, not removed, no block with the host). Guests' own
 * updates never notify anyone, so this is only called for the host.
 */
export const createEventUpdateNotifications = async ({
  eventId,
  hostId,
  eventTitle,
  updateId,
  body,
  recipientIds,
  session,
}: {
  eventId: string;
  hostId: string;
  eventTitle: string;
  updateId: string;
  body: string;
  recipientIds: string[];
  session?: ClientSession;
}) => {
  const recipients = uniqueObjectIdStrings(recipientIds).filter((id) => id !== hostId);

  if (recipients.length === 0) {
    return { created: 0 };
  }

  const users = await getUsersByIds([hostId]);
  const hostName = actorDisplayName(users.get(hostId), "The host");

  return createNotifications(
    recipients.map((recipientId) => ({
      userId: recipientId,
      actorId: hostId,
      type: "event_update" as const,
      targetType: "event" as const,
      targetId: eventId,
      title: `${hostName} posted an update`,
      message: previewText(body),
      metadata: {
        eventTitle,
        updateId,
      },
    })),
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
    removedAt: null,
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
