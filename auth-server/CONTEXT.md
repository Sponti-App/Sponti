# Auth

The identity service. Owns user credentials, JWT issuing (access + refresh), Google sign-in, password reset, avatars, and the identity fields on the user record. It does **not** own business-domain data — see the circles/users ownership decision in `docs/decisions/`.

## Language

**User**:
The identity record: username, displayName, email, credentials, avatar, bio, social handles, and identity-level settings. The `api` context references users by id but does not write them.
_Avoid_: Account, profile (the profile is the user's public-facing view, not a separate entity).

**Profile visibility**:
A user's discoverability setting, `public` or `private`. **Private means discovery-only exclusion**: a private user is omitted from user search, but is still viewable by accepted connections or anyone with their direct link/username. It does not make the profile unreachable: `api`'s `GET /users/by-username/:username` shows anyone signed in the same name, @username and photo for a private user as for a public one (blocked viewers excepted).
_Avoid_: Hidden, locked, incognito.

**Social battery**:
A 0–100 indicator of how open a user currently is to spontaneous plans. Stored on the user and surfaced by the API, but not yet rendered in the app.
_Avoid_: Status, availability, mood.

**Bio**:
A one-line, self-written description on the user (`bio`): at most 80 characters after trimming, line breaks folded into spaces, and an empty value stored as `null`.
_Avoid_: About, description, status.

**Social handles**:
The user's Instagram and Telegram usernames (`instagram`, `telegram`), each stored as a bare, lowercased handle or `null`. `PATCH /auth/me/profile` accepts "@handle" or a pasted profile link (`instagram.com/<h>`, `t.me/<h>`, `telegram.me/<h>`) and stores only the handle. Instagram: 1–30 of `[a-z0-9._]`, no leading, trailing or consecutive dots. Telegram: 5–32 of `[a-z0-9_]`, starting with a letter.

Bio and social handles are returned by `auth-server` only to the user themselves (`GET /auth/me` and the `PATCH /auth/me/profile` response), never in session responses (register, login, Google sign-in) or token claims. Who else may see them is decided in `api`'s profile endpoint (#288), and they must never be added to `api`'s shared user projections (search, events, connections, notifications).
_Avoid_: Socials list, links.
