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
