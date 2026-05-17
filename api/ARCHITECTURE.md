# API Architecture

The API is an Express + TypeScript service for Sponti business logic.

## Layers

- `src/app.ts`: Express app factory, CORS, JSON parsing, health route, API router, error handling.
- `src/server.ts`: database connection and HTTP listener.
- `src/config/env.ts`: strict environment validation with Zod.
- `src/db/connect.ts`: Mongoose connection using `MONGO_URI` and `DB_NAME`.
- `src/middleware`: JWT access-token validation, strict Zod request validation, block guards, errors.
- `src/models`: Mongoose schemas and indexes for business collections.
- `src/schemas`: request body, params, and query validation.
- `src/routes`: `/api/v1` route definitions.
- `src/controllers`: request/response adapters.
- `src/services`: business rules and database operations.

## Auth Boundary

The API does not own users, passwords, refresh tokens, registration, login, logout, or token refresh.
It validates Bearer access tokens signed by `auth-server` using `ACCESS_JWT_SECRET`.

The preferred JWT subject is `sub`; the middleware also accepts the current auth-server `userId` claim
for compatibility.

## Transactions

Multi-document writes use `withTransactionFallback`. In production MongoDB Atlas should support
transactions. Local standalone MongoDB may not; in that case the helper retries without a session.

## Notifications

Notifications are currently represented by:

- `connections` with `status = "pending"`
- `event_members` with `rsvpStatus = "invited"`

`notificationHookService` contains no-op stubs for future async queue integration.

## API Contract

Base path: `/api/v1`

| Method | Endpoint | Auth | Request | Response | Frontend consumer |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/health` | No | none | `{ data: { status, service } }` | deployment/runtime checks |
| `GET` | `/events/map/active` | Yes | query `lng`, `lat`, optional `radiusKm` | `{ data: Event[] }` | home map |
| `GET` | `/events/calendar/upcoming` | Yes | query `page`, `limit` | `{ data: Event[], pagination }` | home calendar |
| `GET` | `/events` | Yes | query `page`, `limit`, `hostId`, `status`, `visibility`, `startAtFrom`, `startAtTo` | `{ data: Event[], pagination }` | host event hub, filtered event lists |
| `GET` | `/events/:eventId` | Yes | param `eventId` | `{ data: Event }` | event details/edit |
| `POST` | `/events` | Yes | event create body | `{ data: { event, members } }` | create flare |
| `PATCH` | `/events/:eventId` | Yes | partial event body | `{ data: Event }` | edit flare |
| `PATCH` | `/events/:eventId/cancel` | Yes | none | `{ data: Event }` | cancel flare |
| `PATCH` | `/events/:eventId/me` | Yes | `{ rsvpStatus?, memberWillArriveAt? }` | `{ data: EventMember }` | join/decline/maybe |
| `GET` | `/circles` | Yes | none | `{ data: CircleWithMembers[] }` | circles page, create-event audience picker |
| `PATCH` | `/circles/:id` | Yes | `{ name?, color? }` | `{ data: Circle }` | edit circle name/color |
| `POST` | `/circles/:id/members` | Yes | `{ userId }` | `{ data: CircleMember }` | add friend to circle |
| `DELETE` | `/circles/:id/members/:userId` | Yes | params | `204` | remove friend from circle |
| `GET` | `/connections` | Yes | query `page`, `limit`, `status`, `type`, `direction` | `{ data: ConnectionWithOtherUser[], pagination }` | people tab |
| `POST` | `/connections/request` | Yes | `{ receiverId, type? }` | `{ data: { processed: true } }` | add by handle |
| `PATCH` | `/connections/:id/respond` | Yes | `{ status: "accepted" \| "rejected" }` | `{ data: Connection }` | respond to connection request |
| `DELETE` | `/connections/:id` | Yes | param `id` | `204` | remove connection |
| `GET` | `/blocks` | Yes | none | `{ data: BlockWithBlockedUser[] }` | blocked tab |
| `POST` | `/blocks/:userId` | Yes | param `userId` | `{ data: Block }` | block user |
| `DELETE` | `/blocks/:userId` | Yes | param `userId` | `204` | unblock user |
| `GET` | `/users/search` | Yes | query `q`, optional `limit` | `{ data: UserSummary[] }` | add by handle |
| `GET` | `/inbox/me` | Yes | none | `{ data: { connectionRequests, eventInvitations } }` | notifications popover |
| `GET` | `/notification-settings/me` | Yes | none | `{ data: NotificationSettings }` | future settings screen |
| `PATCH` | `/notification-settings/me` | Yes | settings patch | `{ data: NotificationSettings }` | future settings screen |
| `POST` | `/qr-contact-tokens` | Yes | `{}` | `{ data: { token, expiresAt, expiresInSeconds } }` | QR share sheet |
| `POST` | `/qr-contact-tokens/resolve` | Yes | `{ token, connect? }` | `{ data: { profile, relationship, canConnect, expiresAt, connection } }` | QR scan confirmation / connect |

Common API errors:

- `400 VALIDATION_ERROR`
- `400 INVALID_OBJECT_ID`
- `401 ACCESS_TOKEN_MISSING`
- `401 ACCESS_TOKEN_INVALID`
- `401 ACCESS_TOKEN_EXPIRED`
- `403` authorization errors
- `404 *_NOT_FOUND`
- `409 DUPLICATE_RESOURCE` or domain conflict
- `500 INTERNAL_SERVER_ERROR`
- `410 QR_CONTACT_TOKEN_EXPIRED`
