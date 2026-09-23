# Circles And Users Are API-Owned Domain Data

## Decision

The `users` and `circles` MongoDB collections are **business-domain data owned by `api/`**, not by `auth-server/`.

`auth-server/` owns only identity: credentials, JWT issuing, password reset, and the identity fields on the user record (username, displayName, email, avatar, `profileVisibility`, `socialBattery`). It must not own or seed business-domain collections.

Default circles ("close friends", "inner circle", "all friends") are created by `api`: `ensureDefaultCircles` seeds any missing system circle idempotently on `GET /circles`, backed by a unique partial index on `{ ownerId, type }` for system types (#102). `auth-server` no longer has a `Circle` model.

There is also one accepted cross-context reference:

- `api` has no `User` model and reads the `users` collection (written by `auth-server`) directly via aggregation lookups. This is currently accepted as a read-only cross-context reference.

## Reason

Two services keeping independent Mongoose schemas for the same collection drift apart (the two `Circle` schemas already disagree on whether `color` is required and on max lengths). Previously, this was made riskier because `auth-server` connected with no explicit `dbName` while `api` connected with `dbName: env.DB_NAME`; if those resolved to different databases, circles seeded at registration could land where `api` never read them.

Issue #89 fixed the minimum database-alignment risk by making both services use the same explicit `MONGO_URI` + `DB_NAME` contract. #102 then resolved the ownership issue by moving default-circle creation into `api`.

## Consequence

- `auth-server` and `api` must continue to point at the same database (`MONGO_URI` + `DB_NAME` aligned), because `api` reads the `users` collection `auth-server` writes.
- Default circles are seeded lazily by `api` on the first authenticated `GET /circles`, not at registration. Anything that needs a user's system circles must go through `ensureDefaultCircles` rather than assume they exist.
- New business-domain fields belong on `api`-owned models. Identity-only fields stay on the `auth-server` `User`.
- `api` reading the `users` collection by ID/projection is acceptable as a read-only cross-context reference; writing it from outside `auth-server` is not.
