# Data Model

This API owns the business collections below. The `users` collection is owned by `auth-server` and is
queried read-only for profile summaries.

## connections

- `requesterId` ObjectId ref `User`
- `receiverId` ObjectId ref `User`
- `status`: `pending | accepted | rejected`, default `pending`
- `type`: `qr | shared_invitation | email_invitation`
- timestamps

Indexes:

- unique `{ requesterId, receiverId }`
- `{ receiverId, status }`
- `{ requesterId, status }`

## circles

- `ownerId` ObjectId ref `User`
- `name`
- `color`
- timestamps

Index: `{ ownerId }`

## circle_members

- `circleId` ObjectId ref `Circle`
- `ownerId` ObjectId ref `User`
- `userId` ObjectId ref `User`
- timestamps

Indexes:

- unique `{ circleId, userId }`
- `{ ownerId, userId }`

## events

- `hostId` ObjectId ref `User`
- `title`
- `description`
- `startAt`
- `endAt`
- `locationName`
- `locationAddress`
- `location` GeoJSON Point `[lng, lat]`
- `visibility`: `public | private`, default `private`
- `allowGuestInvites`, default `false`
- `guestInviteLimit`, default `0`, max `100000`
- `status`: `active | cancelled | completed`, default `active`
- timestamps

Indexes:

- `{ hostId, startAt }`
- `{ status, visibility, startAt }`
- `{ location: "2dsphere" }`

## event_members

- `eventId` ObjectId ref `Event`
- `userId` ObjectId ref `User`
- `invitedBy` ObjectId ref `User`, nullable
- `role`: `host | admin | guest`
- `rsvpStatus`: `invited | going | maybe | declined`, default `invited`
- `canInviteGuests`, default `false`
- `memberWillArriveAt`, nullable
- timestamps

Indexes:

- unique `{ eventId, userId }`
- `{ userId, rsvpStatus }`

## notification_settings

- `userId` ObjectId ref `User`, unique
- `quietHoursEnabled`, default `false`
- `quietHoursStart`, default `22:00`
- `quietHoursEnd`, default `08:00`
- `eventReminders`, default `true`
- `invitationNotifications`, default `true`
- timestamps

Index: unique `{ userId }`

## qr_contact_tokens

Scaffolded only until product behavior is decided.

- `userId` ObjectId ref `User`
- `tokenHash`, unique
- `expiresAt`
- `isActive`, default `true`
- `createdAt`

Indexes:

- unique `{ tokenHash }`
- `{ userId }`

## blocks

- `blockerId` ObjectId ref `User`
- `blockedId` ObjectId ref `User`
- timestamps

Indexes:

- unique `{ blockerId, blockedId }`
- `{ blockerId }`
