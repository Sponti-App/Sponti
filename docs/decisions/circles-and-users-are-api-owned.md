# Circles And Users Are API-Owned Domain Data

## Decision

The `users` and `circles` MongoDB collections are **business-domain data owned by `api/`**, not by `auth-server/`.

`auth-server/` owns only identity: credentials, JWT issuing, password reset, and the identity fields on the user record (username, displayName, email, avatar, `profileVisibility`, `socialBattery`). It must not own or seed business-domain collections.

Today, the remaining ownership violation is:

- `auth-server` defines its own `Circle` model and **seeds default circles at registration** (`authController` creates "inner circle" etc.) — `circles` should be created by `api`.

There is also one accepted cross-context reference:

- `api` has no `User` model and reads the `users` collection (written by `auth-server`) directly via aggregation lookups. This is currently accepted as a read-only cross-context reference.

## Reason

Two services keeping independent Mongoose schemas for the same collection drift apart (the two `Circle` schemas already disagree on whether `color` is required and on max lengths). Previously, this was made riskier because `auth-server` connected with no explicit `dbName` while `api` connected with `dbName: env.DB_NAME`; if those resolved to different databases, circles seeded at registration could land where `api` never read them.

Issue #89 fixed the minimum database-alignment risk by making both services use the same explicit `MONGO_URI` + `DB_NAME` contract. The architectural ownership issue remains: default-circle creation still belongs in `api`, not `auth-server`.

## Consequence

- `auth-server` and `api` must continue to point at the same database (`MONGO_URI` + `DB_NAME` aligned) while default-circle seeding remains in `auth-server`.
- Default-circle creation should move out of `auth-server` registration. Options: `api` seeds on first authenticated request, or registration emits an event `api` consumes.
- New business-domain fields belong on `api`-owned models. Identity-only fields stay on the `auth-server` `User`.
- `api` reading the `users` collection by ID/projection is acceptable as a read-only cross-context reference; writing it from outside `auth-server` is not.
