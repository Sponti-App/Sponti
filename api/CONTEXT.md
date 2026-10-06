# API

The core business-logic service. Owns flares (events), circles, connections, RSVPs, and the in-app notification feed. Mongo + Mongoose, layered controller → service → model.

## Language

**Flare**:
A single event object a user broadcasts to their network. The same flare surfaces in the map view (now / imminent) and the calendar view (upcoming) — timing alone decides which. There is no separate "spontaneous" vs "planned" type.
_Avoid_: Meetup, hangout, post, plan (when referring to the object).

**Circle**:
A user-owned grouping of connections used as an audience target when lighting a flare (e.g. "close", "inner", "all", or a custom one). The canonical word for this concept in both UI and code.
_Avoid_: List, friend list, group.

A flare sent to a host's "all friends" circle also picks up anyone who connects while it is active and not ended (added as an invited guest and notified, unless removed or blocked); custom circles never auto-add, and flares are not backfilled (#426).

**Connection**:
An accepted, mutual friend relationship between two users, stored as an accepted row in each direction. Both rows are needed: a one-sided row is not a connection. A pending request is not yet a connection. See "Connections" in `API_RULES.md`.
_Avoid_: Friend (as a stored entity), follower, contact.

**QR code (in-person connect)**:
A short-lived (15 min) code a user shows on their phone. Scanning it connects both people at once — showing it is the consent, so there is no request to accept. For 24 hours after it expires it still names its owner and lets a signed-in viewer send a friend request (never an instant connection), so a slow sign-up does not strand the scan (#441).
_Avoid_: QR link (when you mean the invite link).

**Invite link**:
A long-lived (7 day), reusable, revocable link a user shares in group chats. Opening it sends the owner a connection request; it never connects instantly. Resetting it revokes the old link and issues a new one.
_Avoid_: Share link, referral link, QR link.

**RSVP**:
A user's participation response to a flare (the join action). Carries an arrival-time intent (ETA) for imminent flares.
_Avoid_: Join status, attendance (as the stored field name).

**In-app notification**:
An entry in the user's notification feed/inbox, persisted as a `Notification` and surfaced in the app's notifications popover. This is what exists today.
_Avoid_: Push, alert (when you mean the feed entry).

**Push notification**:
A device-level APNs/FCM delivery. Distinct from the in-app feed, requires the native shell, and is **not yet built**. Reserve this term strictly for device push so it never gets conflated with the in-app feed.
_Avoid_: Notification (unqualified), alert.

## Who sees open-to-all flares

A flare's `visibility` is `"public"` (shown in the product as "open to all") or `"private"` (invite only).

- **Signed-in users:** "open to all" means every Sponti user. `buildAccessibleEventFilter` lets anyone read a public flare, minus people the host removed and people in a block relationship with the host. Private flares reach only the host and invited members.
- **Signed-out visitors (#425):** they see open-to-all flares as map pins, nothing more. The only endpoint is `GET /api/v1/public/events/map?lng&lat&radiusKm` (radius up to 100 km, default 25). It needs no token, is rate-limited (60 requests a minute per client address, `middleware/rateLimit.ts`) and is the only unauthenticated read of flare data. Every signed-in `/events` route stays behind `requireAuth`, and the signed-out map must never call them.
- **What it returns:** active, not-ended, `visibility: "public"` flares that are live or start within `MAP_SOON_WINDOW_MS` (the same window as the signed-in map), from hosts whose user still exists and has no `suspendedAt` or `deletedAt`. Soonest first, at most 200.
- **Signed-out projection:** `_id`, `type` (the category), `location` (exact `[lng, lat]`), `startAt`, `endAt`. No title, description, location name or address, host, guests, counts, circles or RSVP. `services/publicMapService.ts` builds it field by field from an allowlist, and `publicMapService.db.test.ts` pins the exact key set. Adding a field here is a product decision about what a stranger may learn, not a convenience.
- **Open calls (defaults used):** the position is exact, as signed-in users see it, because an open-to-all flare is meant to be found; the title is not shown on a signed-out pin. Users have no suspended or deleted state yet; the host check reads `suspendedAt` and `deletedAt` so it works the day auth-server starts writing them.
