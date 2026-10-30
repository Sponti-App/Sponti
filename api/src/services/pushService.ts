import webPush from "web-push";
import { Notification, NotificationSettings, PushSubscription } from "#models/index";
import type { NotificationType } from "#models/index";
import { getUsersByIds } from "#services/userDirectoryService";
import { toObjectId, uniqueObjectIdStrings } from "#utils/objectId";

// #639: web push for a few notification types. The in-app feed still gets
// every notification; push only decides which of them also reach the lock
// screen, and when.

type PushConfig = { publicKey: string; privateKey: string; subject: string };

let config: PushConfig | null = null;

// Called once at boot (server.ts). Unset keys leave push off: sends are
// no-ops, and the spa hides the switch because there's no public key.
export const configurePush = (next: PushConfig | null) => {
  config = next;
  if (next) webPush.setVapidDetails(next.subject, next.publicKey, next.privateKey);
};

export const getVapidPublicKey = () => config?.publicKey ?? null;

export const registerPushSubscription = async (
  userId: string,
  input: { endpoint: string; keys: { p256dh: string; auth: string }; timeZone?: string }
) => {
  await PushSubscription.updateOne(
    { endpoint: input.endpoint },
    {
      $set: {
        userId: toObjectId(userId),
        keys: input.keys,
        timeZone: input.timeZone && isValidTimeZone(input.timeZone) ? input.timeZone : "UTC",
      },
    },
    { upsert: true }
  );
};

export const removePushSubscription = async (userId: string, endpoint: string) => {
  await PushSubscription.deleteOne({ userId: toObjectId(userId), endpoint });
};

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
};

const localHhMm = (now: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);

// "22:00"–"08:00" wraps past midnight; start == end means no quiet window.
export const isInQuietHours = (now: Date, timeZone: string, start: string, end: string) => {
  const local = localHhMm(now, isValidTimeZone(timeZone) ? timeZone : "UTC");
  if (start === end) return false;
  return start < end ? local >= start && local < end : local >= start || local < end;
};

// Pushes several joins on one flare within this window as one line
// ("mia and 2 others joined your flare") that replaces the earlier one.
const JOIN_BATCH_WINDOW_MS = 30 * 60_000;

export type PushableNotification = {
  _id: unknown;
  userId: unknown;
  actorId?: unknown;
  type: NotificationType;
  targetId: unknown;
  title: string;
  metadata?: Record<string, unknown> | null;
};

export type PushPayload = { title: string; body: string; url: string; tag: string };

const isPushable = (n: PushableNotification) =>
  n.type === "event_invitation" ||
  n.type === "connection_request" ||
  (n.type === "event_rsvp_change" && n.metadata?.rsvpChange === "joined");

// Lock-screen text: a name and the flare's title, never an address.
export const buildPushPayload = (
  n: PushableNotification,
  actorName: string,
  otherJoins = 0
): PushPayload => {
  const targetId = String(n.targetId);
  const eventTitle = typeof n.metadata?.eventTitle === "string" ? n.metadata.eventTitle : "";

  if (n.type === "event_rsvp_change") {
    const who =
      otherJoins > 0
        ? `${actorName} and ${otherJoins} ${otherJoins === 1 ? "other" : "others"}`
        : actorName;
    return {
      title: `${who} joined your flare`,
      body: eventTitle,
      url: `/?flare=${targetId}`,
      tag: `joins-${targetId}`,
    };
  }

  if (n.type === "event_invitation") {
    return {
      title: `${actorName} lit a flare`,
      body: eventTitle,
      url: `/?flare=${targetId}`,
      tag: `flare-${targetId}`,
    };
  }

  // connection_request, which may come through a flare's invite link (#616).
  const flareInvite = n.metadata?.flareInvite as { kind?: string; eventTitle?: string } | undefined;
  if (flareInvite) {
    return {
      title:
        flareInvite.kind === "joined"
          ? `${actorName} joined via your link`
          : `${actorName} wants to join your flare`,
      body: flareInvite.eventTitle ?? "",
      url: "/?notifications=open",
      tag: `connection-${targetId}`,
    };
  }
  return {
    title: `${actorName} wants to connect`,
    body: "tap to answer",
    url: "/?notifications=open",
    tag: `connection-${targetId}`,
  };
};

const countEarlierJoins = async (n: PushableNotification) =>
  Notification.countDocuments({
    _id: { $ne: toObjectId(String(n._id)) },
    userId: toObjectId(String(n.userId)),
    type: "event_rsvp_change",
    targetId: toObjectId(String(n.targetId)),
    "metadata.rsvpChange": "joined",
    createdAt: { $gte: new Date(Date.now() - JOIN_BATCH_WINDOW_MS) },
  });

/**
 * Sends the pushable ones among freshly created notifications to every device
 * their recipients turned push on in. Called after the notifications are
 * committed; never throws, so a push failure can't fail the request.
 */
export const pushNotifications = async (notifications: PushableNotification[]) => {
  if (!config) return;

  try {
    const pushable = notifications.filter(isPushable);
    if (pushable.length === 0) return;

    const recipientIds = uniqueObjectIdStrings(pushable.map((n) => String(n.userId)));
    const [subscriptions, settings, actors] = await Promise.all([
      PushSubscription.find({ userId: { $in: recipientIds.map(toObjectId) } }).lean(),
      NotificationSettings.find({ userId: { $in: recipientIds.map(toObjectId) } }).lean(),
      getUsersByIds(
        pushable.map((n) => (n.actorId ? String(n.actorId) : null)).filter((id) => id !== null)
      ),
    ]);
    if (subscriptions.length === 0) return;

    const settingsByUser = new Map(settings.map((s) => [String(s.userId), s]));
    const now = new Date();

    await Promise.all(
      pushable.map(async (n) => {
        const userSettings = settingsByUser.get(String(n.userId));
        if (n.type === "event_rsvp_change" && userSettings?.joinNotifications === false) return;

        const actor = n.actorId ? actors.get(String(n.actorId)) : undefined;
        const actorName = actor?.displayName || actor?.username || "someone";
        const otherJoins = n.type === "event_rsvp_change" ? await countEarlierJoins(n) : 0;
        const payload = JSON.stringify(buildPushPayload(n, actorName, otherJoins));

        const devices = subscriptions.filter(
          (s) =>
            String(s.userId) === String(n.userId) &&
            !(
              userSettings?.quietHoursEnabled &&
              isInQuietHours(
                now,
                s.timeZone ?? "UTC",
                userSettings.quietHoursStart,
                userSettings.quietHoursEnd
              )
            )
        );
        await Promise.all(devices.map((s) => sendToDevice(s, payload, n)));
      })
    );
  } catch (error) {
    console.error("Web push failed", error);
  }
};

const sendToDevice = async (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  n: PushableNotification
) => {
  try {
    await webPush.sendNotification(subscription, payload, {
      TTL: 60 * 60,
      urgency: "high",
      // A newer push for the same flare replaces one still waiting on the
      // push service (topic is at most 32 url-safe characters).
      topic: `${n.type === "event_rsvp_change" ? "j" : "n"}${String(n.targetId)}`,
    });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
      return;
    }
    console.error("Web push to one device failed", statusCode ?? error);
  }
};
