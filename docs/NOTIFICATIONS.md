# Notifications Flow

## Purpose

Notifications are Sponti's in-app activity feed for social actions that need a lightweight heads-up: event invitations, event status changes, connection requests, connection acceptances, and RSVP changes on hosted events.

They appear in the frontend notification popover opened from the bottom navigation Feed button. The unread bubble on that button shows the backend unread count. The popover itself is a chronological mixed feed of read and unread notifications, not an unread-only inbox.

## Notification Types

| Type                  | Trigger                                                                                             | Recipient                                                                               | Actor                            | Target                                                          | Example message intent                                           |
| --------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `event_invitation`    | A host creates an event with concrete invitees, either direct users or users expanded from circles. | Each invited non-host user.                                                             | The host or inviter.             | `targetType: "event"`, `targetId: event._id`                    | "Maya invited you to rooftop drinks."                            |
| `event_cancelled`     | A host changes an event from `active` to `cancelled`.                                               | Non-host event members with relevant RSVP status: `invited`, `going`. Never `declined`. | The host.                        | `targetType: "event"`, `targetId: event._id`                    | "Rooftop drinks was cancelled."                                  |
| `event_reactivated`   | A host changes an event from `cancelled` back to `active`.                                          | Non-host event members with relevant RSVP status: `invited`, `going`. Never `declined`. | The host.                        | `targetType: "event"`, `targetId: event._id`                    | "Rooftop drinks was reactivated."                                |
| `connection_request`  | User A sends User B a connection request.                                                           | User B.                                                                                 | User A.                          | `targetType: "connection"`, `targetId: connection._id`          | "Maya wants to connect."                                         |
| `connection_accepted` | User B accepts User A's connection request.                                                         | User A, the original requester.                                                         | User B, the accepting user.      | `targetType: "connection"`, `targetId: accepted connection._id` | "Maya accepted your request. Now you can add @maya to a circle." |
| `event_rsvp_change`   | An invited attendee changes RSVP status for an active event.                                        | The event host.                                                                         | The attendee whose RSVP changed. | `targetType: "event"`, `targetId: event._id`                    | "Jordan is going to rooftop drinks."                             |

## Data Model

The `notifications` collection stores persisted in-app notifications.

| Field        | Meaning                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`        | Notification document id.                                                                                                              |
| `userId`     | Required recipient user id. This is the user whose feed contains the notification.                                                     |
| `actorId`    | Optional user id for the user who triggered the notification. Examples: inviter, host, requester, accepting connection, RSVP attendee. |
| `type`       | One of the notification types listed above.                                                                                            |
| `targetType` | What object the notification points to: `event`, `connection`, or `user`.                                                              |
| `targetId`   | The id of the target event, connection, or user.                                                                                       |
| `title`      | Short display title suitable for the feed.                                                                                             |
| `message`    | Short display body or supporting text.                                                                                                 |
| `readAt`     | `null` means unread. A date means the notification has been shown/read.                                                                |
| `metadata`   | Optional structured context for adapters, routing, labels, or future UI details.                                                       |
| `createdAt`  | Created timestamp. Used for newest-first feed ordering.                                                                                |
| `updatedAt`  | Updated timestamp.                                                                                                                     |

The frontend should consume a DTO from the API and adapt it into the UI notification shape. Do not force UI components to render raw Mongo documents.

## Backend Creation Flow

### Connection Request Sent

When `sendConnectionRequest` creates a new pending connection:

- Create `connection_request`.
- `userId` is the receiver.
- `actorId` is the requester.
- `targetType` is `connection`.
- `targetId` is the pending connection id.

Safeguards:

- Do not create a duplicate when the connection request already exists.
- Respect existing blocked-user stealth behavior.
- Do not create the notification when the request was not delivered.

### Connection Accepted

When a pending connection request is accepted:

- Create `connection_accepted`.
- `userId` is the original requester.
- `actorId` is the accepting receiver.
- `targetType` is `connection`.
- `targetId` should point to the accepted connection row visible to the notified requester.

Also inspect and handle the reverse auto-accept path where sending a request accepts an existing reverse pending request.

Safeguards:

- Create this only once per acceptance transition.
- Do not create it when responding with `rejected`.

### Event Created With Invitees

When an event is created with invitees:

- Resolve direct invitees and circle invitees into concrete user ids.
- Deduplicate recipients before creating event member rows and notifications.
- Create `event_invitation` for each invited non-host user.
- `actorId` is the host or inviter.
- `targetType` is `event`.
- `targetId` is the event id.

Notifications should be created only after the event and invitation/member records are persisted, preferably in the same transaction as event member creation.

Safeguards:

- Exclude the host.
- Avoid duplicates when a user appears through both direct invitation and circle invitation.
- Avoid duplicates if an invitation/member row already exists.

### RSVP Changed

When an event member changes RSVP status on an active event:

- Create `event_rsvp_change`.
- `userId` is the event host.
- `actorId` is the attendee who changed RSVP.
- `targetType` is `event`.
- `targetId` is the event id.

Safeguards:

- Only notify when `rsvpStatus` actually changes.
- Do not notify for ETA-only updates unless product asks for that later.
- Do not notify the actor if they are also the host.
- Do not allow RSVP edits on cancelled events.

### Event Cancelled Or Reactivated

When a host changes status:

- `active` to `cancelled` creates `event_cancelled`.
- `cancelled` to `active` creates `event_reactivated`.
- `actorId` is the host.
- `targetType` is `event`.
- `targetId` is the event id.

Safeguards:

- Notify only non-host members.
- Notify only relevant RSVP statuses: `invited`, `going`.
- Do not notify `declined` users.
- Do not create notifications for no-op repeated actions, such as cancelling an already cancelled event.
- Do not create notifications when status changes to `completed`.

## Backend Read APIs

### `GET /notifications?limit=10&cursor=...`

Returns a chronological mixed feed for the authenticated user, newest first.

Expected response shape:

```json
{
  "data": [
    {
      "_id": "notificationId",
      "type": "event_invitation",
      "targetType": "event",
      "targetId": "eventId",
      "title": "Maya invited you",
      "message": "to rooftop drinks",
      "readAt": null,
      "metadata": {},
      "createdAt": "2026-05-19T10:00:00.000Z",
      "updatedAt": "2026-05-19T10:00:00.000Z",
      "actor": {
        "_id": "userId",
        "username": "maya",
        "displayName": "Maya"
      }
    }
  ],
  "pagination": {
    "nextCursor": "opaque-or-stable-cursor"
  }
}
```

This endpoint returns all notifications, not just unread notifications, because the feed is a chronological history. Read and unread items must remain in order together, and opening the popover only marks fetched and displayed unread items as read.

### `GET /notifications/unread-count`

Returns the number of unread notifications for the authenticated user.

Expected response shape:

```json
{
  "data": {
    "count": 8
  }
}
```

### `PATCH /notifications/read-batch`

Marks exactly the provided notifications as read for the authenticated user.

Expected request body:

```json
{
  "notificationIds": ["notificationId1", "notificationId2"]
}
```

Expected response shape:

```json
{
  "data": {
    "markedRead": 2,
    "unreadCount": 6
  }
}
```

Safeguards:

- Only update notifications owned by the authenticated user.
- Only update notifications where `readAt` is currently `null`.
- Do not mark notifications that were not explicitly included in the batch.

## Frontend Feed Behavior

The feed should behave like a LinkedIn-style notification popover.

- The bottom-nav bubble shows the backend unread count.
- Opening the popover loads the latest 10 total notifications.
- The feed mixes read and unread notifications chronologically, newest first.
- Unread items are visually highlighted.
- Once a fetched batch has been successfully shown, unread notifications from that batch are marked read with `PATCH /notifications/read-batch`.
- Do not mark unloaded notifications as read.
- Scrolling loads the next 10 older notifications and appends them.
- Newly loaded unread notifications are also highlighted briefly and then marked read once displayed.
- Even if the user has more than 10 unread notifications, never load all unread notifications at once.

Example:

If the user has 18 unread notifications, but only 8 of the latest 10 fetched notifications are unread, opening the popover marks only those 8 as read. The unread count drops from 18 to 10. The remaining unread notifications are marked read only if and when older chunks are fetched and shown.

## Frontend State / Cache Strategy

Notification fetching should live in a frontend API module and a shared hook:

- API client: `spa/lib/api/notifications.ts`
- Hook/cache layer: `spa/lib/use-notifications.ts`
- Display component: `spa/components/notifications-popover.tsx`
- Home integration: `spa/app/page.tsx`
- Badge display: `spa/components/bottom-nav.tsx`

Recommended strategy:

- Keep a shared in-memory notification feed cache with subscription, similar to the event cache pattern in `spa/lib/use-events.ts`.
- Store loaded notification pages, `nextCursor`, loading state, and unread count.
- When a read-batch succeeds, update local feed items with `readAt` and update the unread count from the response.
- If the backend does not return a count from read-batch, refetch `GET /notifications/unread-count`.
- Keep the feed and badge synced through the same hook/cache instead of separate local state.

## Navigation Behavior

Notification clicks should route to the most useful stable destination available today:

- `connection_request` routes to `/circles?tab=people`.
- `connection_accepted` routes to `/circles?tab=people`.
- `event_invitation` routes to `/event`.
- `event_cancelled` routes to `/event`.
- `event_reactivated` routes to `/event`.
- `event_rsvp_change` routes to `/event`.

More specific deep links can replace these later if stable event-detail or connection-detail routes are added.

## Current Limitations / Future Improvements

- There is no dedicated full notifications page yet.
- There is no push, email, or async queue integration yet.
- `notification_settings.invitationNotifications` is intended to suppress in-app invitation notifications in the future, but initial implementation should show all notification types.
- Route targets are coarse today and may become more specific later.
- The current frontend notification mock shape does not match the backend notification document shape. Use adapters.
- The current circles people tab is still partially local/mock-backed. Because `connection_request` routes there, backend pending requests must be visible and actionable there.
- The current event invitations destination is `/event`. If invited event cards do not support RSVP actions, add them or document that limitation before release.
- `maybe` RSVP is deprecated for new user actions.

## Tests

Backend coverage should include:

- `connection_request` notification creation when a request is newly created.
- No duplicate `connection_request` notification for existing requests.
- `connection_accepted` notification creation when a pending request is accepted.
- `event_invitation` notification creation for direct invitees and circle-expanded invitees.
- Deduplication when the same invitee appears directly and through a circle.
- `event_rsvp_change` notification only when RSVP status changes.
- No `event_rsvp_change` notification when the actor is the host.
- `event_cancelled` and `event_reactivated` notifications exclude host and declined users.
- No duplicate cancel/reactivate notifications for repeated no-op actions.
- `GET /notifications` returns newest-first paginated mixed read/unread notifications.
- `GET /notifications/unread-count` returns only unread notifications for the authenticated user.
- `PATCH /notifications/read-batch` marks only owned, explicitly listed unread notifications as read.

Frontend coverage should include:

- The unread bubble uses backend unread count.
- Opening the popover fetches only the latest 10 notifications.
- Read and unread notifications render together newest first.
- Unread items render with distinct styling before read-batch state updates.
- Read-batch sends only unread IDs from the fetched and displayed batch.
- Unread count updates after read-batch.
- Loading older notifications appends the next page and marks only that new page's unread items as read.
- `connection_request` click routes to `/circles?tab=people`.
- Event notification clicks route to `/event`.
