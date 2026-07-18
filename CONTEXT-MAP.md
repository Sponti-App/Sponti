# Context Map

Sponti is one product split across three deployable services, each its own bounded context with its own domain language.

## Contexts

- [API](./api/CONTEXT.md) — core business logic: flares (events), circles, connections, RSVPs, the in-app notification feed.
- [Auth](./auth-server/CONTEXT.md) — identity: registration, login, JWT issuing, password reset, avatars.
- [SPA](./spa/CONTEXT.md) — the Next.js/Capacitor presentation layer the user actually touches.

## Relationships

- **SPA → Auth**: the SPA authenticates against `auth-server` (`/auth/*`) and stores the JWT, which it then sends to the API.
- **SPA → API**: all flare/circle/connection/notification reads and writes go through `api/`.
- **Auth → API (shared collection)**: `auth-server` currently seeds a new user's default **circles** at registration directly into Mongo, a collection the API also owns. This cross-context write is a known coherence risk — see the circles source-of-truth decision under `docs/decisions/`.
