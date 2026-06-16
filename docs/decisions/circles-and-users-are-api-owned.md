# Circles And Users Are API-Owned Domain Data

## Decision

The `users` and `circles` MongoDB collections are **business-domain data owned by `api/`**, not by `auth-server/`.

`auth-server/` owns only identity: credentials, JWT issuing, password reset, and the identity fields on the user record (username, displayName, email, avatar, `profileVisibility`, `socialBattery`). It must not own or seed business-domain collections.

Today this is violated in two places, to be corrected:

- `auth-server` defines its own `Circle` model and **seeds default circles at registration** (`authController` creates "inner circle" etc.) — `circles` should be created by `api`.
- `api` has no `User` model and reads the `users` collection (written by `auth-server`) directly via aggregation lookups.

## Reason

Two services keeping independent Mongoose schemas for the same collection drift apart (the two `Circle` schemas already disagree on whether `color` is required and on max lengths). Worse, `auth-server` connects with no explicit `dbName` while `api` connects with `dbName: env.DB_NAME` — if those resolve to different databases, circles seeded at registration land where `api` never reads them, so a new user's default circles silently never appear. This is a latent "works in the demo, breaks for a real user" bug, and it contradicts the separation of concerns stated in `CLAUDE.md` (`auth-server` = authentication, `api` = business logic).

## Consequence

- Default-circle creation should move out of `auth-server` registration. Options: `api` seeds on first authenticated request, or registration emits an event `api` consumes. Until migrated, `auth-server` and `api` **must** point at the same database (`MONGO_URI` + `DB_NAME` aligned) or default circles break.
- New business-domain fields belong on `api`-owned models. Identity-only fields stay on the `auth-server` `User`.
- `api` reading the `users` collection by ID/projection is acceptable as a read-only cross-context reference; writing it from outside `auth-server` is not.
