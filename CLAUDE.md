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
- Figtree font, Tailwind v4, shadcn/ui (radix-nova) design system
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
- Tailwind CSS + shadcn/ui for styling

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

- When coding UI, only use the pre-installed UI library shadcn with the Nova preset or default shadcn styling
