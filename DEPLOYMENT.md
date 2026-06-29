# Deployment & operations

This file captures **how Sponti is hosted, what it depends on, and who owns each account** — so a migration is a runbook, not archaeology. It exists because deployment config previously lived in one person's hosting dashboard and was lost when they left.

> Secrets do **not** belong in this file or anywhere in git (the repo is public). This documents *structure and ownership only*. Actual values live in the shared password-manager vault and in each host's env-var store.

---

## Topology

Three independently deployed services, all built from this one repo (different root dirs), plus external SaaS.

| Service | Root dir | Runtime | Natural host | Notes |
| --- | --- | --- | --- | --- |
| `sponti-spa` | `spa/` | Next.js (SSR) | **Vercel** | Zero-config; Vercel auto-detects Next. No `vercel.json` needed. Also wrapped by Capacitor for iOS/Android. |
| `sponti-api` | `api/` | Express + Mongoose, `app.listen` | **Railway / Render** (see decision below) | Long-running server, ESM, Node subpath imports. `npm start` → `node dist/server.js`. |
| `sponti-auth` | `auth-server/` | Express + Mongoose, `app.listen` | **Railway / Render** (see decision below) | Same shape. `npm start` builds then runs `dist/app.js`. |

External services (all team-reachable; **not** the departed member's personal accounts):

| Service | Used by | Purpose |
| --- | --- | --- |
| MongoDB Atlas (`cluster0.3yzmbp0`) | api, auth-server | Primary datastore. DB name `sponti`. |
| Cloudinary | auth-server | Avatar / media uploads. |
| Google Cloud | spa, auth-server | Maps JS SDK + Places, and OAuth web client (Google sign-in). |
| Resend | auth-server | Transactional email, from `noreply@contact.sponti.fun`. |
| Domain `sponti.fun` | spa (public URL), Resend (sender) | DNS is team-controlled. |

---

## Account ownership map

> Keep this current. The gap here is half of why the last lockout hurt.

| Account | Owner / where | Status |
| --- | --- | --- |
| Vercel (old `sponti-spa`/`sponti-api`/`sponti-auth` projects) | departed member's personal account | **Locked — being replaced.** |
| Vercel (new, team-owned) | _fill in: team/owner_ | _set up in progress_ |
| MongoDB Atlas | _fill in_ | team-reachable |
| Cloudinary | _fill in_ | team-reachable |
| Google Cloud project | _fill in_ | team-reachable |
| Resend | _fill in_ | team-reachable |
| Domain registrar / DNS (`sponti.fun`) | _fill in_ | team-controlled |

---

## Environment variables (keys only)

Source of truth: shared vault → mirrored into each host's env settings. `*.env.example` in each package is the authoritative key list.

**`spa/` (Vercel project env):**
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_AUTH_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `GOOGLE_MAPS_API_KEY` (server-only Places proxy).

**`api/`:**
`MONGO_URI`, `DB_NAME`, `PORT`, `CLIENT_BASE_URL`, `CORS_ORIGINS`, `ACCESS_JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_ID`.

**`auth-server/`:**
`MONGO_URI`, `PORT`, `APP_URL`, `CORS_ORIGINS`, `ACCESS_JWT_SECRET`, `REFRESH_JWT_SECRET`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

> **CORS is env-driven.** Both backends read `CORS_ORIGINS` (comma-separated) first; the `sponti-spa.vercel.app` string in code is only a dev fallback. Set `CORS_ORIGINS` in each backend's env to the SPA's public origin(s) and you never touch code. See `api/src/app.ts` (`getAllowedCorsOrigins`) and `auth-server/src/app.ts`.

---

## Decision needed: where do `api` and `auth-server` run?

Both are long-running `app.listen` Express servers, not serverless handlers.

- **Option A — Railway / Render (recommended).** Runs the existing `npm start` scripts unchanged. Natural fit for persistent Express + a pooled Mongo connection. Zero code change.
- **Option B — Vercel serverless.** Requires splitting app-from-`listen` (auth-server calls `app.listen` at module load), exporting an Express handler, and adding `vercel.json` per service. More moving parts; Mongo connection pooling needs care across cold starts. Only worth it to keep everything on one provider.

Until this is decided, no `vercel.json` is committed for the backends on purpose — committing a speculative one would be misleading.

---

## Migration runbook (minimal: new host, reuse keys)

1. **Back up every secret to the shared vault** (one item per service + the ownership map above). Do this first — values currently live on one laptop.
2. **Stand up `sponti-spa` on a team-owned Vercel team**: import this repo, root dir `spa/`, framework auto-detected. Paste the `spa/` env vars.
3. **Stand up `api` and `auth-server`** per the decision above (Railway/Render recommended). Paste their env vars.
4. **Set `CORS_ORIGINS`** on both backends to the SPA's public origin(s) (e.g. `https://sponti.fun,https://<new-spa>.vercel.app`).
5. **Point the SPA's `NEXT_PUBLIC_AUTH_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`** at the new backend URLs.
6. **Reconfigure external services — only for URLs that change** (keeping `sponti.fun` avoids most of this):
   - Google OAuth → add new authorized JS origins / redirect URIs.
   - Google Maps key → add new HTTP referrer.
   - Atlas → verify IP allowlist permits the new host (serverless hosts are dynamic-IP; likely already `0.0.0.0/0`).
7. **Repoint `sponti.fun` DNS** to the new SPA deployment so the public URL — and therefore OAuth origins, Maps referrers, CORS, and email sender — stay stable.
8. **Verify the core loop end-to-end**: sign in → light a flare → a friend sees it → RSVP.

## After the tester round: rotate

The departed member held every current secret. Before any public store listing, rotate: new `ACCESS_JWT_SECRET` / `REFRESH_JWT_SECRET`, a fresh Atlas DB user, and regenerated Google / Resend / Cloudinary keys. Update the vault and each host's env in lockstep.
