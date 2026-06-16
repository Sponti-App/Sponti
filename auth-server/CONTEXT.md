# Auth

The identity service. Owns user credentials, JWT issuing (access + refresh), Google sign-in, password reset, avatars, and the identity fields on the user record. It does **not** own business-domain data — see the circles/users ownership decision in `docs/decisions/`.

## Language

**User**:
The identity record: username, displayName, email, credentials, avatar, and identity-level settings. The `api` context references users by id but does not write them.
_Avoid_: Account, profile (the profile is the user's public-facing view, not a separate entity).

**Profile visibility**:
A user's discoverability setting, `public` or `private`. **Private means discovery-only exclusion**: a private user is omitted from user search, but is still viewable by accepted connections or anyone with their direct link/username. It does not make the profile unreachable.
_Avoid_: Hidden, locked, incognito.

**Social battery**:
A 0–100 indicator of how open a user currently is to spontaneous plans. Stored on the user and surfaced by the API, but not yet rendered in the app.
_Avoid_: Status, availability, mood.
