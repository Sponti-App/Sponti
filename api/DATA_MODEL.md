# Data Model

This document tracks the broader Sponti data model, including collections owned by `auth-server`,
collections owned by `api`, and a few planned collections that are not fully implemented yet.

Implementation note:

- `users` and `refresh_tokens` are owned by `auth-server`.
- Most business collections below are owned by `api`.
- `favLocations`, `notifyWhen`, and `maxDistanceKm` are documented here as part of the current target
  schema, even though the API code has not fully implemented them yet.

## users

```text
Table users {
  _id ObjectId [pk]
  username string [unique]
  displayName string // optional
  email string [unique]
  passwordHash string [unique]
  avatarUrl string // optional
  avatarPublicId string
  profileVisibility profile_visibility_status
  socialBattery number // optional
  createdAt datetime
  updatedAt datetime
}

Enum profile_visibility_status {
  public
  private // default
}
```

## connections

```text
Table connections {
  _id ObjectId [pk]

  requesterId ObjectId [ref: > users._id]
  receiverId ObjectId [ref: > users._id]

  status status_type
  type connection_type
  createdAt datetime
  updatedAt datetime

  indexes {
    (requesterId, receiverId) [unique]
    (receiverId, status)
    (requesterId, status)
  }
}

Enum status_type {
  pending // default
  accepted
  rejected
}

Enum connection_type {
  qr
  shared_invitation
  email_invitation
}
```

## circles

For now, in the frontend there will be just 2 circles; no more circles will be created or added.

```text
Table circles {
  _id ObjectId [pk]

  ownerId ObjectId [ref: > users._id]
  name string
  color string // optional by now

  createdAt datetime
  updatedAt datetime

  indexes {
    (ownerId)
  }
}
```

## circle_members

```text
Table circle_members {
  _id ObjectId [pk]

  circleId ObjectId [ref: > circles._id]
  ownerId ObjectId [ref: > users._id]
  userId ObjectId [ref: > users._id]

  createdAt datetime
  updatedAt datetime

  indexes {
    (circleId, userId) [unique]
    (ownerId, userId)
  }
}
```

## favLocations

Planned collection. Not yet implemented in the current API code.

```text
Table favLocations {
  _id ObjectId [pk]

  userId ObjectId [ref: > users._id]
  locationName string
  locationAddress string // optional
  location Object // GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
}
```

## events

```text
Table events {
  _id ObjectId [pk]

  hostId ObjectId [ref: > users._id]

  title string
  description string

  startAt datetime
  endAt datetime

  locationName string
  locationAddress string // optional
  location Object // GeoJSON Point: { type: "Point", coordinates: [lng, lat] }

  visibility event_visibility

  allowGuestInvites boolean
  guestInviteLimit number

  status event_status

  createdAt datetime
  updatedAt datetime

  indexes {
    (hostId, startAt)
    (startAt)
    (status, startAt)
  }
}

Enum event_visibility {
  public
  private // default
}

Enum event_status {
  active // default
  cancelled
  completed
}
```

## event_members

```text
Table event_members {
  _id ObjectId [pk]

  eventId ObjectId [ref: > events._id]
  userId ObjectId [ref: > users._id]

  invitedBy ObjectId [ref: > users._id] // Can be null if it's the host

  role role
  rsvpStatus rsvpStatus

  canInviteGuests boolean

  memberWillArriveAt datetime // The time, calculate it before (null if it's the host)

  createdAt datetime
  updatedAt datetime

  indexes {
    (eventId, userId) [unique]
    (userId, rsvpStatus)
  }
}

Enum rsvpStatus {
  invited // default
  going
  maybe
  declined
}

Enum role {
  host
  admin
  guest
}
```

## notification_settings

`notifyWhen` and `maxDistanceKm` are part of the target schema and are not yet fully implemented in
the current API code.

```text
Table notification_settings {
  _id ObjectId [pk]

  userId ObjectId [ref: > users._id]

  quietHoursEnabled boolean
  quietHoursStart string // "22:00"
  quietHoursEnd string // "08:00"

  eventReminders boolean
  invitationNotifications boolean // Do you know be notify?
  notifyWhen notifyWhen
  maxDistanceKm number // Min: 0, max: 50 default 0 meaning false

  createdAt datetime
  updatedAt datetime

  indexes {
    (userId) [unique]
  }
}

Enum notifyWhen {
  any_friend
  inner_circle // default
}
```

## qr_contact_tokens

```text
Table qr_contact_tokens {
  _id ObjectId [pk]

  userId ObjectId [ref: > users._id]

  tokenHash string [unique]
  expiresAt datetime
  isActive boolean

  createdAt datetime

  indexes {
    (tokenHash)
    (userId)
  }
}
```

## refresh_tokens

Owned by `auth-server`.

```text
Table refresh_tokens {
  _id ObjectId [pk]

  userId ObjectId [ref: > users._id]

  tokenHash string [unique]

  expiresAt datetime
  revokedAt datetime // optional

  createdAt datetime
  updatedAt datetime

  indexes {
    (userId)
    (tokenHash) [unique]
    (expiresAt)
  }
}
```

## blocks

```text
Table blocks {
  _id ObjectId [pk]

  blockerId ObjectId [ref: > users._id]
  blockedId ObjectId [ref: > users._id]
  createdAt datetime
  updatedAt datetime

  indexes {
    (blockerId, blockedId) [unique]
    (blockerId) // retrieve all the users the user has blocked
  }
}
```
