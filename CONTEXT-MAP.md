# Context Map

Sponti is one product split across three deployable services, each its own bounded context with its own domain language.

## Contexts

- [API](./api/CONTEXT.md) — core business logic: flares (events), circles, connections, RSVPs, the in-app notification feed.
- [Auth](./auth-server/CONTEXT.md) — identity: registration, login, JWT issuing, password reset, avatars.
- [SPA](./spa/CONTEXT.md) — the Next.js/Capacitor presentation layer the user actually touches.

## Relationships

- **SPA → Auth**: the SPA authenticates against `auth-server` (`/auth/*`) and stores the JWT, which it then sends to the API.
- **SPA → API**: all flare/circle/connection/notification reads and writes go through `api/`.
- **Auth → API (shared collection)**: `api` reads the `users` collection that `auth-server` writes (read-only cross-context reference). Default **circles** are no longer seeded by `auth-server`; `api` creates them lazily on the first `GET /circles` (#102) — see the circles source-of-truth decision under `docs/decisions/`.
