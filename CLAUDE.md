# CLAUDE.md

This file provides the canonical team-vetted guidance for AI coding agents working in this repository.
Claude Code reads this file directly. Codex reads `AGENTS.md`, which points back here to avoid duplicating instructions.

## What is Sponti

A social meetup app that reduces friction for spontaneous and planned gatherings among friends. The core concept is "lighting a flare" — broadcasting to your network that you're doing something now or soon and letting friends join. The map view surfaces what's happening right now; the calendar view surfaces upcoming events. Both views show the same event object, just filtered by timing.

Key differentiators: low-notification noise, granular privacy controls (per-list visibility, public/private events, quiet hours), and fast creation.

## Project status

**Timeline:** 16-day bootcamp sprint. Team of 4 (UX/UI, frontend dev, tech lead, PM).

**Completed:**

- Home screen — map view with flares + calendar view toggle
- Design system bootstrapped — Tailwind v4 + shadcn Nova preset + Figtree font (see [Brand & Design System](#brand--design-system))
- Capacitor set up for iOS/Android WebView wrapper

**Next to build (in priority order):**

1. Auth — email/password register + login (backend scaffolded, frontend needed)
2. Event creation flow — title, time, location, visibility picker, post
3. Event joining flow - click on map, details, route to event with ETA, add to calendar
4. Friend lists — add friends, organise into lists, use lists as invite targets
5. Profile — view/edit, public/private toggle
6. Notification settings — per-type preferences, quiet hours
7. QR code — generate card, scan to add friend

**Deferred to v2:**

- Phone number auth + contact importing
- React Native migration (Expo) — v1 ships as Capacitor WebView

## Post-demo roadmap (tester build → app stores)

The 7-item list above is built; the prototype is deployed. The operative plan now is to take it from "working demo" to a build we can hand to 5–10 friends who use it as a real app, then on to the stores.

**Guiding principles:**

- **Hide, never delete.** Unfinished or unwired surfaces are gated behind `spa/lib/feature-flags.ts` — one typed, compile-time profile that flips between "tester build" and "full app". Nothing is removed from the tree.
- **Real data, not fake.** Empty-states-first. Any demo seed lives behind an off-by-default `seedDemoData` flag and is decoupled from `NEXT_PUBLIC_API_BASE_URL` (today, mock data is wrongly tied to "no backend configured").
- **The core loop must be real:** sign in → light a flare → a friend sees it → joins (RSVP). Verified wired end-to-end; everything else can be thin.

**Milestone 1 — Tester build (the shareable cut):**

- Add `spa/lib/feature-flags.ts`. Hide behind flags: +1 / guest invites (backend done, no redemption UX), re-share / `allowForward` (frontend-only, unpersisted), social handles (localStorage-only), `socialBattery` (unrendered). **Keep custom circles** — fully wired.
- Decouple demo data from `API_BASE`; add `seedDemoData` (off). Add real empty states for map, calendar, circles.
- Wire stubbed settings to the backends that already exist: `profileVisibility` toggle and notification preferences (`GET/PATCH /notification-settings/me`); verify/hide change-password.
- **Enforce profile privacy (discovery-only contract):** `userDirectoryService` must exclude `private` users from search — it is stored-but-ignored today. Private users stay viewable by connections or via direct link.
- Resolve the circles/users cross-service coupling per `docs/decisions/circles-and-users-are-api-owned.md`. Minimum bar: align `MONGO_URI` + `DB_NAME` across `api/` and `auth-server/` so registration-seeded default circles don't vanish.
- **🚩 Surface attendee ETAs to the host.** The "let host know" arrival time (`memberWillArriveAt`) is collected at join and stored on `EventMember`, but is **write-only** — the host never sees it. To fix for the tester build: (1) show each going attendee's ETA in the host's event view (`event-detail-sheet` "who's going" + `/event/[id]`); (2) include the ETA in the RSVP-change notification (`createEventRsvpChangeNotification` isn't passed `memberWillArriveAt` today); (3) fire a notification (or update) when a *going* member changes only their ETA — currently silent because it keys off `rsvpStatusChanged`; (4) null out `memberWillArriveAt` on `declined` so a stale arrival time doesn't linger. Signature differentiator, currently half-wired.

**Milestone 2 — Native distribution (store-prep):**

- TestFlight (Apple Developer Program, $99/yr; internal testing = up to 100 testers, no review) + Google Play internal testing ($25 one-time). These are pre-listing beta channels — no public store listing required to share.
- `npm run build:mobile` → archive/upload → invite testers.

**Milestone 3 — Push notifications (its own milestone, native-only):**

- The **in-app notification feed already exists** and is sufficient for tester round 1. **Device push is not built**: no `@capacitor/push-notifications`, no APNs/FCM, no device-token registration. This milestone adds that infrastructure and wires notification preferences to gate delivery.

**Deferred past the tester round:** +1 redemption UX, social-handles backend, `socialBattery` surfacing, richer profile (bio/avatar image/visibility indicator), QR polish.

> Domain language and the rationale behind these decisions are captured in `CONTEXT-MAP.md`, the per-context `CONTEXT.md` files, and `docs/decisions/`.

## Platform strategy

v1 is a **Next.js web app wrapped in Capacitor** for iOS/Android. The SPA is served as a web application and can be exported for mobile usage.

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
npm run build         # Production static export → out/
npm run build:mobile  # next build + cap sync (deploy to native)
npm run open:ios      # Open Xcode
npm run open:android  # Open Android Studio
npm run lint          # ESLint
npm run format        # Prettier (ts/tsx)
npm run typecheck     # tsc --noEmit
```

### Capacitor dev workflow

```bash
cd spa
npm run dev                # start Next.js on localhost:3000
npx cap run ios            # run in iOS Simulator with live reload
npx cap run android        # run in Android emulator with live reload
```

### auth-server

```bash
cd auth-server
npm run dev          # node --watch (no compile step)
npm run build        # tsc → dist/
npm start            # build then run dist/app.js
```

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
- Stack: Tailwind v4 + shadcn Nova preset + Radix + Lucide.
- Recurring patterns: `border-l-[3px] border-l-accent` for live/active rows, `bg-card text-primary` for selected segmented/tab states, FAB only on map view, ended/past states muted and folded behind a "show N ended" toggle.
- Do not fall back to stock shadcn `--accent` — we override it with the brand peach in both modes.

For full tokens (light + dark oklch tables), spacing rhythm, component recipes, voice rules, and "what to avoid" — see [BRAND.md](./BRAND.md).
---

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
