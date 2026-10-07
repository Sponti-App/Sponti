# CLAUDE.md

This file provides the canonical team-vetted guidance for AI coding agents working in this repository.
Claude Code reads this file directly. Codex reads `AGENTS.md`, which points back here to avoid duplicating instructions.

## What is Sponti

A social meetup app that reduces friction for spontaneous and planned gatherings among friends. The core concept is "lighting a flare" — broadcasting to your network that you're doing something now or soon and letting friends join. The map view surfaces what's happening right now; the calendar view surfaces upcoming events. Both views show the same event object, just filtered by timing.

Key differentiators: low-notification noise, granular privacy controls (per-list visibility, public/private events, quiet hours), and fast creation.

## Project status

Started as a 16-day bootcamp sprint by a team of 4 (UX/UI, frontend dev, tech lead, PM). The original build list is done: auth, flare creation, joining (route + ETA), friend lists (circles), profile, notification settings and QR connect. The prototype is deployed, and the work now is getting it ready for real testers (see the roadmap below).

**Deferred to v2:**

- Phone number auth + contact importing
- React Native migration (Expo) — v1 ships as Capacitor WebView

## Post-demo roadmap (tester build → app stores)

The goal is a build we can hand to 5–10 friends who use it as a real app, then the stores. **Testing happens on the web app first** (sponti-flame.vercel.app on phone browsers). Native builds and the stores (Milestone 2) come after that round, so web-tester blockers rank above native-only problems.

**Guiding principles:**

- **Understand before you change.** No sweeping refactors against code the team doesn't yet share an understanding of. Fixes are read-the-slice-first, small, and individually reviewable. Tracked as GitHub issues so each change is scoped and reviewed, not bundled.
- **Hide, never delete.** Unfinished or unwired surfaces are gated behind `spa/lib/feature-flags.ts`, one typed, compile-time profile that flips between "tester build" and "full app". Nothing is removed from the tree.
- **Real data, not fake.** Empty-states-first. Demo data lives behind the off-by-default `seedDemoData` flag.
- **The core loop must be real:** sign in → light a flare → a friend sees it → joins (RSVP). Everything else can be thin.

**Milestone 1 — Tester build (the shareable cut):**

_Phase 0 — Understand & fix: done._ Codebase walkthrough (#87), discovery-only profile privacy in search (#88), circles/users owned by `api/` with aligned DBs (#89, #102), attendee ETAs surfaced to the host (#90, #211), settings wired to their backends (#91), demo data decoupled + real empty states (#92).

_Phase 1 — Gate for external testers: done (#93)._ The tester profile in `spa/lib/feature-flags.ts` hides re-share (#231) and +1 (#159 still decides what they become). `socialBattery` stays unrendered. **Keep custom circles**, which are fully wired.

_Profile rebuild: done (#166)._ Photo, one-line bio and Instagram/Telegram handles. Bio and handles are visible to connections only. Strangers see name, @username and photo, and a user who blocked you gets "not found". The fields live in `auth-server/`, and `api/` reads them. Open privacy calls: #268.

_Map pins and icon set: done (#315, #345)._ Each flare pin is one circle with its category icon, plum for invite only and teal for open to all (`spa/components/map-flare-pin.tsx`); peach on a pin means live only. Phosphor replaced Lucide: every icon comes from `spa/components/icons.tsx`, and ESLint blocks importing an icon package anywhere else. Dates and times go through the lowercase formatters in `spa/lib/format-date.ts` (#339).

_Current work (tracked as GitHub issues):_

- **Pre-launch checklist (#274):** the living list of to-dos before sharing with testers. Add launch blockers there.
- **Ideas on a quiet map (#240):** curated Berlin idea spots (`spa/lib/flare-ideas.data.ts`, owned by the team) offered as one-tap flares.
- **Flare moments (#370), the top priority:** watching testers showed they don't understand what Sponti is or how to use it. The fix explains Sponti before sign-up with intro slides, lets visitors look around the map before they sign up (sign-up comes when they light a flare), reworks the existing first-run intro, and makes lighting a flare and a first join into moments (a fuse lights the flare's category icon once the api confirms it). Prototypes come first, and every surface ships behind a flag. This changes the flare UI's composition and personality, not its features. Decisions: `docs/decisions/flare-moments-direction.md`. **Status (2026-10-04):** the join data (#414) and the detail sheet above the nav (#419) are in, and the first-join moment (#380) is fully briefed. The intro is in a second prototype round (#373, draft PR #407), the lighting motion is being re-explored (#371, draft PR #405), and #425 (who "open to all" flares reach) must be decided before the map opens to signed-out visitors (#389). The tracker (#370) lists what is blocked and what is ready for an agent.
- **Unparked by that finding:** first-friend onboarding (#124: QR connect and the 7-day invite link work, and still need a real-phone check) and the composer layout (#311), which now takes in the optional capture step for flare art.

**Milestone 2 — Native distribution (store-prep, after the web round):**

- TestFlight (Apple Developer Program, $99/yr; internal testing = up to 100 testers, no review) + Google Play internal testing ($25 one-time). These are pre-listing beta channels, so no public store listing is needed to share.
- First decide how the Capacitor app loads the SPA (#205): static export was removed, so `build:mobile` no longer produces `out/`.

**Milestone 3 — Push notifications (its own milestone, native-only):**

- The **in-app notification feed exists** (a bottom sheet with swipe actions) and is enough for tester round 1. **Device push is not built**: no `@capacitor/push-notifications`, no APNs/FCM, no device-token registration. This milestone adds that infrastructure and wires notification preferences to gate delivery.

**Deferred past the tester round:** +1 redemption UX, `socialBattery` surfacing, QR polish.

> Domain language and the rationale behind these decisions are captured in `CONTEXT-MAP.md`, the per-context `CONTEXT.md` files, and `docs/decisions/`.

## Platform strategy

v1 is a **Next.js web app wrapped in Capacitor** for iOS/Android. The SPA is served as a web application; how the native shell loads it is still open (#205).

v2 plan: migrate to Expo/React Native if there is traction.

## Repository structure

| Directory      | Purpose                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `spa/`         | Frontend application — Next.js (App Router), React components, hooks, UI, and client-side logic           |
| `api/`         | Main API server — handles business logic such as events, circles, invitations, and core app functionality |
| `auth-server/` | Authentication server — Express + MongoDB handling authentication, authorization, JWTs, and user identity |

## Commands

### Frontend (`spa/`)

Run these commands from the `spa/` directory.

```bash
cd spa
npm run dev           # Next.js dev server with Turbopack (localhost:3000)
npm run build         # Production build (no static export; see #205)
npm run build:mobile  # next build + cap sync (native builds need #205 settled)
npm run open:ios      # Open Xcode
npm run open:android  # Open Android Studio
npm run lint          # ESLint
npm run format        # Prettier (CI runs format:check, so format before committing)
npm run typecheck     # tsc --noEmit
npm test              # Vitest unit tests
npm run test:e2e      # Playwright e2e against stubbed backends (e2e/support/stubs.ts)
```

Design questions get a throwaway route under `spa/app/prototype/<name>/` (dev-only, nothing links to it) with committed screenshots, opened as a draft "prototype:" PR that is closed once a direction is picked.

Playwright starts its own dev server on port 4415, plus a second one with the full feature profile on that port + 1000 (5415, for the `mobile-full-profile` project in `e2e/full-profile/`). Set `PLAYWRIGHT_WEB_SERVER_PORT` to run several copies side by side (e.g. one per git worktree); both ports move with it (or set `PLAYWRIGHT_FULL_WEB_SERVER_PORT`). UI checks use the stubbed e2e setup, not real data: the local `.env` points at the shared database.

### Capacitor dev workflow

```bash
cd spa
npm run dev                # start Next.js on localhost:3000
npx cap run ios            # run in iOS Simulator with live reload
npx cap run android        # run in Android emulator with live reload
```

### api

```bash
cd api
npm run dev          # tsx watch
npm test             # Vitest (unit + mongodb-memory-server db tests)
npm run typecheck && npm run lint
npm run format       # Prettier (CI runs format:check)
```

### auth-server

```bash
cd auth-server
npm run dev          # node --watch (no compile step)
npm run build        # tsc → dist/
npm start            # build then run dist/app.js
```

## Branches, PRs and deploys

- Branch from `dev` and open PRs against `dev`, never `main`. CI runs the spa, api and auth-server checks on every PR.
- `dev` is merged into `main` to release. `main` deploys to production (Vercel project `sponti`, https://sponti-flame.vercel.app). `dev` deploys to https://sponti-git-dev-spontis-projects.vercel.app, so check new work there before it reaches `main`.
- Backends run on the team's netcup VPS (Docker Compose + Caddy): `https://api.152-53-198-143.sslip.io` and `https://auth.152-53-198-143.sslip.io`. A merge into `dev` that touches `api/`, `auth-server/` or `deploy/netcup/` deploys them automatically (`.github/workflows/deploy-backends.yml`). Runbook, logs and manual deploys: `deploy/netcup/README.md`. Secrets live only on the server, and `CORS_ORIGINS` there must list any new SPA origin.
- GitHub only auto-closes issues on merges into the default branch (`main`), so close an issue by hand, linking the PR, once that PR is merged to `dev`.
- Stage explicit paths (`git add <file>`), never a symlinked `node_modules`.

## Architecture

### Frontend (SPA)

- **Next.js (App Router)** with React
- Handles UI, routing, and client-side state
- Communicates with `apis/` and `auth-server/` via HTTP (REST APIs)
- Styling tokens, typography, and component conventions live in [Brand & Design System](#brand--design-system) — follow it for every UI artifact

### APIs server

- Core backend for the application
- Handles:
  - Events (creation, retrieval, updates)
  - Circles / friend groups
  - Invitations and participation
- Contains main business logic
- Connects to database (MongoDB)

### auth-server

- Dedicated authentication service
- Express + MongoDB + JWT
- Responsibilities:
  - User registration & login
  - Token issuing (access + refresh)
  - Authorization middleware
- Decoupled from main API for scalability and separation of concerns

---

## Brand & Design System

Canonical reference: [BRAND.md](./BRAND.md). Read it before touching styling.

**Quick recap for AI agents:**

- One CTA color in both modes: saturated peach `oklch(0.8041 0.126 52.09)` (`--primary`, `--accent`, `--ring`). Foreground on peach: dark warm `oklch(0.25 0.06 50)`.
- Light mode bg: pale pink-cream `oklch(0.97 0.015 346)`. Dark mode bg: ink-black navy `oklch(0.2178 0.0145 266.91)`.
- Typography: **Bricolage Grotesque** (one family, 4-step scale 18/16/14/12 px, hierarchy via weight + color not size). All product copy lowercase.
- Stack: Tailwind v4 + shadcn Nova preset + Radix + Phosphor icons (regular weight; the active bottom-nav tab uses fill), imported only through `spa/components/icons.tsx`.
- Recurring patterns: `border-l-[3px] border-l-accent` for live/active rows, `bg-card text-primary` for selected segmented/tab states, one flare button, in the middle of the bottom nav (no FAB on the map), ended/past states muted and folded behind a "show N ended" toggle.
- Do not fall back to stock shadcn `--accent` — we override it with the brand peach in both modes.

## For full tokens (light + dark oklch tables), spacing rhythm, component recipes, voice rules, and "what to avoid" — see [BRAND.md](./BRAND.md).

## Data model note

A flare/event is a **single object** surfaced in two views:

- Map → now / imminent
- Calendar → upcoming

There is no separate "spontaneous" vs "planned" type — only timing determines which view it appears in.

---

## Auth

- v1: email/password with JWT tokens
- Managed by `auth-server/`
- Other services validate tokens via middleware
- Phone number auth deferred to v2

---

## Important notes

- Keep clear separation of concerns:
  - `spa/` → presentation layer
  - `api/` → business logic
  - `auth-server/` → authentication

- Never trust client input — validate and compute sensitive data server-side

- Environment variables must never be exposed to the frontend unless prefixed  
  (e.g., `NEXT_PUBLIC_*`)

- Do not add private planning notes, raw meeting notes, or agent handoffs to this code repository.

- When coding UI, use shadcn with the Nova preset and the Sponti tokens defined in [Brand & Design System](#brand--design-system) — Sponti overrides some Nova defaults (notably `--accent` for the warm-red brand color), so do not fall back to stock shadcn styling

---

## Agent skills

### Issue tracker

Issues and PRDs are tracked as GitHub issues in `Sponti-App/Sponti` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default 1:1 vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — per-package `CONTEXT.md` in `spa/`, `api/`, `auth-server/`, with system-wide decisions in `docs/decisions/`. See `docs/agents/domain.md`.

---

## Issue investigation levels

Before creating or investigating a bug, implementation, refactoring, or technical-debt issue:

- follow the workflow in [Issue Tracker](docs/agents/issue-tracker.md);
- classify the issue using the [Issue Investigation Level Classification Standard](docs/agents/issue-investigation-levels.md);
- apply exactly one investigation-level label using the vocabulary in [Triage Labels](docs/agents/triage-labels.md);
- record the proposed level and a concise classification reason in the issue body;
- apply mandatory Level 3 triggers;
- use Level 2 when uncertain;
- select the higher level when two levels appear equally reasonable.

A newly created issue is not automatically approved for implementation. Use `needs-triage` as the default workflow status during initial issue capture, and do not apply `ready-for-agent` unless readiness has been explicitly established.

When investigating an issue, validate its provisional classification before completing the investigation. Replace the investigation-level label when escalation is required, and explain the reclassification in the investigation report.
