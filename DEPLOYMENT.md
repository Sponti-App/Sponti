# Deployment & operations

This file captures **how Sponti is hosted, what it depends on, and who owns each account** — so a migration is a runbook, not archaeology. It exists because deployment config previously lived in one person's hosting dashboard and was lost when they left.

> Secrets do **not** belong in this file or anywhere in git (the repo is public). This documents *structure and ownership only*. Actual values live in the shared password-manager vault and in each host's env-var store.

---

## Topology

Three independently deployed services, all built from this one repo (different root dirs), plus external SaaS.

| Service | Root dir | Runtime | Natural host | Notes |
| --- | --- | --- | --- | --- |
| `sponti-spa` | `spa/` | Next.js (SSR) | **Vercel** | Zero-config; Vercel auto-detects Next. No `vercel.json` needed. Also wrapped by Capacitor for iOS/Android. |
| `sponti-api` | `api/` | Express + Mongoose, `app.listen` | **Render** (Web Service) | Long-running server, ESM, Node subpath imports. `npm start` → `node dist/server.js`. |
| `sponti-auth` | `auth-server/` | Express + Mongoose, `app.listen` | **Render** (Web Service) | Same shape. `npm start` builds then runs `dist/app.js`. |

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
| Vercel — new `sponti-spa` | team-owned _(add owner name)_ | ✅ deployed |
| Render — `sponti-api` + `sponti-auth` | team-owned _(add owner name)_ | ✅ deployed |
| Vercel — old `sponti-spa`/`sponti-api`/`sponti-auth` | departed member's personal account | **Locked — decommission once `sponti.fun` DNS is confirmed on the new SPA.** |
| MongoDB Atlas (`cluster0.3yzmbp0`) | team-reachable _(add owner name)_ | in use |
| Cloudinary | team-reachable _(add owner name)_ | in use |
| Google Cloud project (Maps + OAuth) | team-reachable _(add owner name)_ | in use |
| Resend | team-reachable _(add owner name)_ | in use |
| Domain registrar / DNS (`sponti.fun`) | team-controlled _(add owner name)_ | in use |

---

## Environment variables (keys only)

Source of truth: shared vault → mirrored into each host's env settings. `*.env.example` in each package is the authoritative key list.

**`spa/` (Vercel project env):**
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_AUTH_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `GOOGLE_MAPS_API_KEY` (server-only Places proxy).

**`api/`:**
`MONGO_URI`, `DB_NAME`, `PORT`, `CLIENT_BASE_URL`, `CORS_ORIGINS`, `ACCESS_JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_ID`.

**`auth-server/`:**
`MONGO_URI`, `DB_NAME`, `PORT`, `APP_URL`, `CORS_ORIGINS`, `ACCESS_JWT_SECRET`, `REFRESH_JWT_SECRET`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

> **Shared database contract:** `api` and `auth-server` must use the same `MONGO_URI` and `DB_NAME`. Default-circle seeding still happens in `auth-server`, so a mismatch makes newly seeded circles invisible to `api`.

> **CORS is env-driven.** Both backends read `CORS_ORIGINS` (comma-separated) first; the `sponti-spa.vercel.app` string in code is only a dev fallback. Set `CORS_ORIGINS` in each backend's env to the SPA's public origin(s) and you never touch code. See `api/src/app.ts` (`getAllowedCorsOrigins`) and `auth-server/src/app.ts`.

---

## Backend hosting — Render (decided)

`api` and `auth-server` run as **Render Web Services**, one per package, from this repo. Render runs the existing `npm start` unchanged — no serverless adapter, no code change. (Vercel serverless was rejected: it would require splitting app-from-`listen` and a handler refactor for long-running Express + Mongoose.)

Per service, in the Render dashboard:

| Setting | `api` | `auth-server` |
| --- | --- | --- |
| Root Directory | `api` | `auth-server` |
| Build Command | `npm install && npm run build` | `npm install && npm run build` |
| Start Command | `node dist/server.js` | `node dist/app.js` |
| Health check path | `/health` | `/health` |

Notes:
- **Start Command runs the built output directly — do NOT use `npm start` for `auth-server`.** Its `npm start` triggers a `prestart: npm run build`, which re-runs `tsc` at boot on the 512 MB runtime instance and **OOMs** (see Troubleshooting). The build already happens in the Build Command; recompiling at start is redundant and fatal. (`api` has no `prestart`, but we use the direct invocation for both for consistency.)
- Render issues HTTPS URLs (e.g. `https://sponti-api.onrender.com`) — this is what makes the direct-URL frontend wiring below work without mixed-content issues.
- **Free tier spins down on idle** (~50s cold start on first request). Fine for the tester round; revisit if testers hit it.
- Render's outbound IPs are dynamic on lower tiers, so set the Atlas IP allowlist to `0.0.0.0/0` (or Render's static-IP add-on later).

## Frontend → backend wiring (direct URLs, no proxy)

The dev `.env` points `NEXT_PUBLIC_AUTH_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` at `/proxy/auth` and `/proxy/api`. Those are **relative paths that depend on a host rewrite** which lived in the old Vercel dashboard and is **not in this repo** (no `next.config` rewrites, no `app/proxy` route handler) — so it did not survive the migration.

Decision: **skip the proxy, use direct absolute backend URLs.** Since Render serves HTTPS and CORS is env-driven, the proxy's only purpose (avoiding mixed-content) is moot. In the SPA's Vercel env, set:

```
NEXT_PUBLIC_AUTH_BASE_URL=https://sponti-auth.onrender.com
NEXT_PUBLIC_API_BASE_URL=https://sponti-api.onrender.com
```

(`http.ts` `resolveConfiguredBaseUrl` accepts a comma-separated candidate list; a single absolute URL is the simplest valid case.) If you ever need same-origin calls or to hide backend URLs, re-add the proxy as committed `next.config` rewrites — never as dashboard-only config.

---

## Migration runbook (minimal: new host, reuse keys)

1. **Back up every secret to the shared vault** (one item per service + the ownership map above). Do this first — values currently live on one laptop.
2. **Stand up `sponti-spa` on a team-owned Vercel team**: import this repo, root dir `spa/`, framework auto-detected. Paste the `spa/` env vars.
3. **Stand up `api` and `auth-server` as Render Web Services** using the settings in "Backend hosting" above. Paste their env vars.
4. **Set `CORS_ORIGINS`** on both backends to the SPA's public origin(s) (e.g. `https://sponti.fun,https://<new-spa>.vercel.app`).
5. **Point the SPA's `NEXT_PUBLIC_AUTH_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`** at the new backend URLs.
6. **Reconfigure external services — only for URLs that change** (keeping `sponti.fun` avoids most of this):
   - Google OAuth → add new authorized JS origins / redirect URIs.
   - Google Maps key → add new HTTP referrer.
   - Atlas → verify IP allowlist permits the new host (serverless hosts are dynamic-IP; likely already `0.0.0.0/0`).
7. **Repoint `sponti.fun` DNS** to the new SPA deployment so the public URL — and therefore OAuth origins, Maps referrers, CORS, and email sender — stay stable.
8. **Verify the core loop end-to-end**: sign in → light a flare → a friend sees it → RSVP.

## Troubleshooting (Render)

Both backends run `connectDB()` **before** `app.listen` (`api/src/server.ts`, `auth-server/src/app.ts`). So **anything that crashes or hangs at startup means the port never binds**, and Render reports `No open ports detected, continuing to scan…` until the process dies. That message is a symptom, not the cause — always read the lines *above* it / before the exit code.

| Symptom | Real cause | Fix |
| --- | --- | --- |
| `Exited with status 134` + `FATAL ERROR: … JavaScript heap out of memory` | `auth-server` Start Command was `npm start`, whose `prestart` re-runs `tsc` at boot and OOMs the 512 MB instance | Start Command = `node dist/app.js` (run the built output; don't rebuild at start). |
| `No open ports detected, continuing to scan…` then exit | App crashed before `app.listen` (often the OOM above, or a Mongo failure) | Read the log lines above it; match to the rows here. |
| `MongooseServerSelectionError` / `ETIMEDOUT` | Mongo unreachable — Atlas IP allowlist missing the host | Atlas → Network Access → `0.0.0.0/0`. |
| `Error: MONGO_URI is not defined` | `MONGO_URI` unset / misnamed on that service | Set it (copy the working value from the other service). |
| `MongoParseError` | `MONGO_URI` malformed (truncated paste / unencoded chars) | Re-paste the full URI from a working service. |
| CORS error in browser, request blocked | `CORS_ORIGINS` doesn't exactly match the SPA origin | Set `CORS_ORIGINS` = SPA origin, scheme+host, no trailing slash. |

> Debugging order that works: read the **last error before the exit code**, not the exit code itself. `134` = SIGABRT (usually OOM); `137` = SIGKILL (platform OOM-killer); the scan message = no port bound.

## After the tester round: rotate

The departed member held every current secret. Before any public store listing, rotate: new `ACCESS_JWT_SECRET` / `REFRESH_JWT_SECRET`, a fresh Atlas DB user, and regenerated Google / Resend / Cloudinary keys. Update the vault and each host's env in lockstep.
