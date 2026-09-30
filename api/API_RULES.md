# API Rules

## Security

- All `/api/v1/*` routes require a Bearer access token, except `/api/v1/public/*` (see Public Routes).
- `/health` is public.
- Access tokens are verified with `ACCESS_JWT_SECRET`.
- Sensitive ownership fields must come from the JWT, not the request body.
- Unknown body/query/param fields are rejected by strict Zod schemas.
- User passwords and refresh tokens are never exposed or managed here.

## Response Shape

Success:

```json
{ "data": {} }
```

Paginated success:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Error:

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": []
  }
}
```

## Authorization

- Event updates and cancellations are host-only.
- Private events are visible only to the host and invited members.
- Public events still require login. Anyone who can see a public event can join it by answering going or declined; people the host removed or who are blocked either way can't. Private events can only be answered by people on the guest list.
- When a host switches an event from public to private, guests who joined on their own and are `going` keep their spot; joiners who aren't going are dropped. Invited guests are never touched. Switching private to public keeps the invite list.
- Only the host can list, add and remove event guests. A removed guest can't see or rejoin the event, even a public one, until the host invites them again.
- A flare's guest limit (`guestInviteLimit`) is a hard cap on `going` members — invited or self-joined, host excluded — only while `allowGuestInvites` is `"none"`. Once +1 or re-share is on, the limit is approximate and isn't enforced. The host can still invite past the limit; an invitee who tries to answer `going` once it's full gets `409 EVENT_FULL` and their invite is left untouched. Enforced atomically (`PATCH /events/:id/me`), so two people can't take the last spot.
- A flare's thread of updates (`/events/:id/updates`) can be read and posted to only by the host and guests who are `going`. Invited, declined and removed guests, members in a block relationship with the host, and strangers on a public flare get `403 EVENT_THREAD_FORBIDDEN`; someone who can't see the flare and was never on it gets the same `404 EVENT_NOT_FOUND` as the event itself. Anyone who can see the flare gets its `updateCount`. Updates by someone in a block relationship with the viewer are left out.
- Posting is only open while the flare is `active` and hasn't ended (`409 EVENT_THREAD_CLOSED` otherwise); a cancelled or ended thread stays readable, and reactivating reopens it. A host's update notifies each going guest once (`event_update`); a guest's notifies nobody.
- An update can be deleted (soft, idempotent) by its author or the flare's host. There is no editing.
- `GET /events/:id` returns `myWillArriveAt`, the caller's own arrival time (or `null`). Other guests' arrival times are only ever sent to the host, on `attendees[].willArriveAt`.
- `PATCH /notifications/read-batch` marks up to 10 caller-owned notification ids read at once. `PATCH /notifications/read-all` ("I'm caught up") marks every one of the caller's unread notifications read in one call, not just a loaded page — scoped to `createdAt` at or before the moment the request is handled, so a notification created mid-request isn't swallowed before the caller ever saw it. Both return the caller's resulting `unreadCount`.
- A going member's arrival answer is either a minute-based time (`memberWillArriveAt`) or, for a flare that hasn't started but starts within the hour, a near-term status (`arrivalStatus`: `"on_time"` or `"running_late"`). The two are mutually exclusive — sending a real value for both on `PATCH /events/:id/me` is `400 VALIDATION_ERROR`, and setting one (to a real value) clears the other, whether or not the request mentions it. `GET /events/:id` returns the caller's own as `myArrivalStatus`; the host also gets `attendees[].arrivalStatus`, on the same host-only terms as `willArriveAt`. Declining nulls out both.
- `GET /users/by-username/:username` (someone's profile, #199) returns only `profile: { id, username, displayName, avatarUrl }`, the caller's `relationship` to them (`self`, `connected`, `pending_outgoing`, `pending_incoming`, `blocked`, `none`) and the pending request's `connectionId`. Profile visibility is discovery-only, so a public and a private user look the same here. Bio, socials, email and visibility are never returned. If the caller blocked them it's `blocked` (so they can unblock); if they blocked the caller it's the same `404 USER_NOT_FOUND` as an unknown username. A rejected request reads as `none`. `connected` follows the definition under Connections.
- Circles can only be managed by their owner.
- Circles are snapshots: sending a flare to a circle copies its members into the flare at that moment. The flare remembers which circles it was sent to (`invitedCircleIds`) only so the host can be asked whether someone added to the circle later should be invited too; that is always an explicit host action (`POST /events/:id/members`), never automatic. `GET /circles/:id/events` lists the owner's upcoming flares for a circle.
- Circle members must be connections of the owner (see Connections).
- Blocks are stealthy: blocked invitation attempts return a generic processed response.

## Connections

- An accepted connection is stored as a mirrored pair of `connections` rows, one per direction, both `accepted`. Accepting a request, the reverse auto-accept and the in-person QR connect all write the pair.
- **Connected** means an accepted row in **both** directions and no block either way. A one-sided accepted row grants nothing: it reads as `none`, doesn't count as a friend, and doesn't unlock anything that is for connections only (#260). Data should always be symmetric; requiring both rows means a leftover or buggy one-sided row can't give someone access.
- There is one definition in code: `relationshipService` (#267). `getRelationship(viewer, other)` answers `self`, `blocked`, `connected`, `pending_outgoing`, `pending_incoming` or `none`, in that order of precedence (plus who placed a block, and the pending request's id). `getConnectedUserIds(user, candidates?)` answers "who is this user connected to". The QR code and invite link screens, someone's profile, user search, circle membership, "all friends" and flare invites all use these. Don't write another "are these two connected?" query.
- A rejected request reads as `none`; the requester is never told they were turned down.
- `DELETE /connections/:id` deletes one of the caller's own rows. For an accepted row the mirrored row goes too, so a pair never ends up one-sided.
- `npm run cleanup:connections` (in `api/`) is the one-off #260 cleanup: it finds one-sided accepted rows and rows a block would remove today (pending or accepted rows between blocked users). It never deletes rejected rows. Dry run by default, printing counts and ids only; `-- --apply` deletes. It uses `MONGO_URI` and `DB_NAME` from `api/.env`, so check where that points first.

## Blocks

When A blocks B:

- Create `blocks` document `A -> B`.
- Delete pending and accepted rows in both directions. Both accepted rows go (#260), so after an unblock neither side is connected and they have to reconnect.
- Keep rejected rows from either side. A block and unblock never wipes anyone's earlier "no", so whoever was turned down still gets `CONNECTION_REJECTED` if they ask again.
- Remove B from A's circles.
- Do not remove B from events.
- Filter B's events from A's map/calendar/inbox results.
- Unblocking only deletes the `blocks` document. It never restores a connection.

## QR Contact Tokens

- QR tokens are random bearer secrets; store only `tokenHash`.
- Tokens expire after 15 minutes and can be reused until expiry.
- Creating a new token does not deactivate older unexpired tokens, so an in-flight
  scan does not break if the owner refreshes or reopens the QR sheet.
- Resolving a token returns a confirmation payload. It creates a connection only
  when the caller passes `connect: true`.
- If either user blocked the other, resolving returns a generic not-found error.

## Instant QR Connect, Invite Links And Public Routes

- Resolving a QR token with `connect: true` connects both users at once (both mirrored
  `connections` rows `accepted`, no request step). Showing the QR in person is the owner's
  consent; the 15-minute TTL is what keeps that safe. A pending (or earlier rejected) request
  in either direction is turned into the connection. Self and already-connected are no-ops.
  The owner gets a `connection_accepted` notification.
- Invite links (`/invite-links`) are the group-chat path: one live link per user, valid 7 days,
  reusable by many people, revocable by the owner (`POST /invite-links/me/reset` revokes every
  live link and issues a new one). Resolving with `connect: true` only sends a connection
  request (type `shared_invitation`). Revoked links read as `404 INVITE_LINK_NOT_FOUND`,
  expired as `410 INVITE_LINK_EXPIRED`, and blocks either way as `404`.
- Invite tokens are stored as-is (not hashed) so the owner can re-share the same link.

### Public Routes

- `/api/v1/public/*` is mounted ahead of `requireAuth` and is reachable without a token.
  Keep it minimal and never branch on who is asking.
- `POST /api/v1/public/contact-preview` `{ kind: "qr" | "invite", token }` returns only
  `{ data: { displayName } }` for a live token, with `Cache-Control: no-store`. Unknown,
  expired, revoked, cross-kind or owner-missing tokens all return the same
  `404 CONTACT_PREVIEW_NOT_FOUND`. It has no viewer, so no block check; the authenticated
  resolve endpoints enforce blocks before anything else is shown or changed.
- There is no in-app rate limit yet; tokens are 256-bit random values, so guessing one is
  not practical.

## Profile Decisions (#268)

Decided 2026-09-30. These record what `GET /users/by-username/:username` and the profile page already do; none of them changed behaviour.

- **Block from a stranger's profile stays.** Anyone except yourself and people you've already blocked can be blocked, whether or not you're connected.
- **A private profile opened by link shows name, @username and photo.** That is the bare minimum strangers get, matching the discovery-only contract: private users are left out of search but can be viewed by anyone signed in who has the username or link.
- **Username probing is accepted for now.** Usernames are public handles, and exact-username search already reveals whether one exists. Rate limiting comes later, once `trust proxy` is set up behind Caddy on the netcup server, so the api sees real client IPs.

## TODO Areas

- Connection retry behavior after rejection.
- Future pagination for inbox.
- Future custom index/migration strategy.
