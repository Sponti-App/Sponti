import { randomBytes } from "node:crypto";
import { type Types } from "mongoose";
import { Event, EventInviteLink, EventMember, PendingEventInvite } from "#models/index";
import { sendConnectionRequest } from "#services/connectionService";
import { updateMyEventMembership } from "#services/eventService";
import { inviteGuestToFlare } from "#services/pendingFlareInviteService";
import { getRelationship, type Relationship } from "#services/relationshipService";
import { getInactiveUserIds, getUsersByIds } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";

// A flare's own invite link (#616). Having the link counts as being invited,
// so it works for invite-only flares too, but it never connects strangers and
// never opens an invite-only flare without the host saying yes:
//
// - open-to-all flare: redeeming joins the guest as going (through the same
//   gate as any join: blocks, removal, the guest limit). Not yet friends: the
//   host also gets a friend request.
// - invite-only flare, already friends: the guest is invited straight away.
// - invite-only flare, not friends: the host gets a friend request and the
//   guest a pending invite (PendingEventInvite). The guest waits; accepting the
//   request invites them (pendingFlareInviteService, called from every accept
//   path). A decline, a cancelled request or the flare ending lapses it.
//
// Every way a link can fail to work (unknown or reset token, ended or
// cancelled flare, a suspended or deleted host, a block either way, a guest
// the host removed) is the same 404, so a link can't be used to probe any of
// those states. See models/EventInviteLink.ts for where the token lives.

const TOKEN_BYTES = 32;

const notFound = () => new AppError("Invite link not found", 404, "FLARE_INVITE_NOT_FOUND");

const newToken = () => randomBytes(TOKEN_BYTES).toString("base64url");

export type FlareInviteState =
  /** The viewer's own flare. */
  | "host"
  /** On the flare and going. */
  | "going"
  /** On the flare's guest list, not answered (or declined). */
  | "invited"
  /** An invite-only flare: the host has to accept the friend request first. */
  | "waiting"
  /** Nothing yet: "i'm in" redeems the link. */
  | "none";

type LiveFlare = {
  _id: Types.ObjectId;
  hostId: Types.ObjectId;
  title: string;
  type: string;
  startAt: Date;
  endAt: Date;
  locationName: string;
  visibility: "public" | "private";
  allowGuestInvites?: string | null;
  invitedCircleIds?: Types.ObjectId[];
};

/**
 * What anyone holding the link may see, signed in or not (#616): who invited
 * them, and the flare's title, kind, time and place name. Never the address,
 * the coordinates, the flare's id, guests, counts or updates. Built field by
 * field so a field added to the Event model later can't reach a stranger by
 * accident; `flareInvite.db.test.ts` pins the exact key set.
 */
export type FlareInvitePreview = {
  host: { displayName: string; avatarUrl: string | null };
  title: string;
  type: string;
  startAt: Date;
  endAt: Date;
  placeName: string;
};

const buildPreview = async (event: LiveFlare): Promise<FlareInvitePreview> => {
  const hostId = event.hostId.toString();
  const host = (await getUsersByIds([hostId])).get(hostId);

  return {
    host: {
      displayName: host?.displayName?.trim() || host?.username || "someone",
      avatarUrl: host?.avatarUrl ?? null,
    },
    title: event.title,
    type: event.type,
    startAt: event.startAt,
    endAt: event.endAt,
    placeName: event.locationName,
  };
};

/**
 * The flare behind a token, or null unless the link works right now: the flare
 * is active and not over, and its host still exists and is not suspended or
 * deleted (#542).
 */
const findLiveFlare = async (token: string): Promise<LiveFlare | null> => {
  const link = await EventInviteLink.findOne({ token }).select("eventId").lean();

  if (!link) {
    return null;
  }

  const event = await Event.findOne({
    _id: link.eventId,
    status: "active",
    endAt: { $gt: new Date() },
  })
    .select(
      "_id hostId title type startAt endAt locationName visibility allowGuestInvites invitedCircleIds"
    )
    .lean();

  if (!event) {
    return null;
  }

  const hostId = event.hostId.toString();
  const hostExists = (await getUsersByIds([hostId])).has(hostId);

  if (!hostExists || (await getInactiveUserIds()).includes(hostId)) {
    return null;
  }

  return event as LiveFlare;
};

// ---- host ------------------------------------------------------------------

const findHostedLiveFlare = async (hostId: string, eventId: string) => {
  const event = await Event.findOne({ _id: toObjectId(eventId), hostId: toObjectId(hostId) })
    .select("_id status endAt")
    .lean();

  if (!event) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  if (event.status !== "active" || event.endAt <= new Date()) {
    throw new AppError("This flare is over, so it has no invite link", 409, "EVENT_NOT_SHAREABLE");
  }

  return event;
};

/** The host's invite link for a flare, issued the first time it is asked for. */
export const getHostInviteLink = async (hostId: string, eventId: string) => {
  const event = await findHostedLiveFlare(hostId, eventId);
  const link = await EventInviteLink.findOneAndUpdate(
    { eventId: event._id },
    { $setOnInsert: { hostId: toObjectId(hostId), token: newToken() } },
    { upsert: true, returnDocument: "after" }
  ).lean();

  return { token: link.token };
};

/** Replaces the flare's token: the old link stops working at once. */
export const resetHostInviteLink = async (hostId: string, eventId: string) => {
  const event = await findHostedLiveFlare(hostId, eventId);
  const link = await EventInviteLink.findOneAndUpdate(
    { eventId: event._id },
    { $set: { token: newToken() }, $setOnInsert: { hostId: toObjectId(hostId) } },
    { upsert: true, returnDocument: "after" }
  ).lean();

  return { token: link.token };
};

// ---- anyone holding the link -------------------------------------------------

/** For the signed-out landing: the public preview of a live link. */
export const getFlareInvitePreview = async (token: string) => {
  const event = await findLiveFlare(token);

  if (!event) {
    throw notFound();
  }

  return buildPreview(event);
};

type FlareInviteResult = {
  state: FlareInviteState;
  /** Only once the viewer is on the flare (or hosts it): someone who is
   * waiting never learns which flare it is. */
  eventId: string | null;
  preview: FlareInvitePreview;
};

const result = (
  state: FlareInviteState,
  event: LiveFlare,
  preview: FlareInvitePreview
): FlareInviteResult => ({
  state,
  eventId: state === "waiting" || state === "none" ? null : event._id.toString(),
  preview,
});

const isConnected = (relationship: Relationship) => relationship === "connected";

// A request the viewer already sent stays pending; an incoming one is
// accepted by sending one back (sendConnectionRequest's reverse-pending path).
const canSendRequest = (relationship: Relationship) =>
  relationship === "none" || relationship === "pending_incoming";

type Standing = {
  kind: "host" | "member" | "pending" | "none";
  relationship: Relationship;
  /** Only for a member. */
  rsvpStatus?: string;
};

/** Where the viewer stands with this flare. Throws the 404 for a block or a removal. */
const findStanding = async (viewerId: string, event: LiveFlare): Promise<Standing> => {
  const hostId = event.hostId.toString();

  if (viewerId === hostId) {
    return { kind: "host", relationship: "self" };
  }

  const { relationship } = await getRelationship(viewerId, hostId);

  if (relationship === "blocked") {
    throw notFound();
  }

  const member = await EventMember.findOne({
    eventId: event._id,
    userId: toObjectId(viewerId),
  })
    .select("rsvpStatus removedAt")
    .lean();

  if (member?.removedAt) {
    throw notFound();
  }

  if (member) {
    return { kind: "member", relationship, rsvpStatus: member.rsvpStatus };
  }

  if (await PendingEventInvite.exists({ eventId: event._id, guestId: toObjectId(viewerId) })) {
    return { kind: "pending", relationship };
  }

  return { kind: "none", relationship };
};

const memberState = (rsvpStatus: string | undefined): FlareInviteState =>
  rsvpStatus === "going" ? "going" : "invited";

/** Where the viewer stands with a link, without changing anything. */
export const getFlareInviteStatus = async (viewerId: string, token: string) => {
  const event = await findLiveFlare(token);

  if (!event) {
    throw notFound();
  }

  const [standing, preview] = await Promise.all([
    findStanding(viewerId, event),
    buildPreview(event),
  ]);

  switch (standing.kind) {
    case "host":
      return result("host", event, preview);
    case "member":
      return result(memberState(standing.rsvpStatus), event, preview);
    case "pending":
      return result("waiting", event, preview);
    case "none":
      return result("none", event, preview);
  }
};

/**
 * Sends the host a friend request that says it came through this flare's link.
 * Never connects anyone: the host still has to accept. Returns false when the
 * host had already declined this person: that stays declined, and the guest is
 * not told.
 */
const requestFriendship = async (
  viewerId: string,
  event: LiveFlare,
  kind: "joined" | "waiting"
): Promise<boolean> => {
  try {
    await sendConnectionRequest(
      viewerId,
      { receiverId: event.hostId.toString(), type: "shared_invitation" },
      {
        eventId: event._id.toString(),
        eventTitle: event.title,
        kind,
        circleIds: (event.invitedCircleIds ?? []).map(String),
      }
    );
    return true;
  } catch (error) {
    if (error instanceof AppError && error.code === "CONNECTION_REJECTED") {
      return false;
    }
    throw error;
  }
};

/** "i'm in": redeems the link for the signed-in viewer. */
export const redeemFlareInvite = async (viewerId: string, token: string) => {
  const event = await findLiveFlare(token);

  if (!event) {
    throw notFound();
  }

  const preview = await buildPreview(event);
  const standing = await findStanding(viewerId, event);

  if (standing.kind === "host") {
    return result("host", event, preview);
  }

  if (event.visibility === "public") {
    // "i'm in" is a yes, so an open-to-all flare takes them as going whatever
    // they were before (invited, declined, nothing). The one join gate checks
    // blocks, removal and the guest limit (409 EVENT_FULL), and tells the host.
    if (standing.rsvpStatus !== "going") {
      await updateMyEventMembership(viewerId, event._id.toString(), { rsvpStatus: "going" });
    }

    if (canSendRequest(standing.relationship)) {
      await requestFriendship(viewerId, event, "joined");
    }

    return result("going", event, preview);
  }

  // Invite-only from here on.
  if (standing.kind === "member") {
    return result(memberState(standing.rsvpStatus), event, preview);
  }

  if (isConnected(standing.relationship)) {
    await inviteGuestToFlare(event, viewerId);
    return result("invited", event, preview);
  }

  // Not friends: the host decides. Record the wait before the request goes out,
  // so a request that is accepted on the spot (the host had already asked the
  // guest) finds the pending invite and grants it.
  await PendingEventInvite.updateOne(
    { eventId: event._id, guestId: toObjectId(viewerId) },
    { $setOnInsert: { hostId: event.hostId } },
    { upsert: true }
  );

  if (canSendRequest(standing.relationship)) {
    const sent = await requestFriendship(viewerId, event, "waiting");

    if (!sent) {
      // The host already said no to this person: nothing to wait for, and the
      // guest still just sees "waiting".
      await PendingEventInvite.deleteOne({ eventId: event._id, guestId: toObjectId(viewerId) });
      return result("waiting", event, preview);
    }
  }

  const after = await findStanding(viewerId, event);

  return result(
    after.kind === "member" ? memberState(after.rsvpStatus) : "waiting",
    event,
    preview
  );
};
