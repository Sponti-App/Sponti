# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
3. Friend lists — add friends, organise into lists, use lists as invite targets
4. Profile — view/edit, public/private toggle
5. Notification settings — per-type preferences, quiet hours
6. QR code — generate card, scan to add friend

**Deferred to v2:**
- Phone number auth + contact importing
- React Native migration (Expo) — v1 ships as Capacitor WebView

## Platform strategy

v1 is a **Next.js web app wrapped in Capacitor** for iOS/Android. The `out/` static export is what Capacitor serves. In dev, Capacitor points to `http://localhost:3000` for live reload.

v2 plan: migrate to Expo/React Native if there is traction.

## Repository structure

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router pages and layouts |
| `components/` | React components (`ui/` for shadcn primitives) |
| `lib/` | Shared utilities (`utils.ts` — `cn` helper) |
| `hooks/` | Custom React hooks |
| `auth-server/` | Auth backend — Express 5 + MongoDB (own `package.json`) |
| `ios/` | Capacitor iOS project (gitignored) |
| `android/` | Capacitor Android project (gitignored) |
| `api/` | Future API workspace (placeholder) |
| `spa/` | Future SPA workspace (placeholder) |

## Commands

### Frontend (repo root)
```bash
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

### Frontend
- **Next.js 16** (App Router, static export via `output: 'export'`) with React 19.
- **Tailwind CSS v4** via PostCSS (`@tailwindcss/postcss`).
- **shadcn/ui** with `radix-nova` style; add components via `npx shadcn add <component>`. Path aliases: `@/components/ui`, `@/lib`, `@/hooks`.
- **Figtree** font loaded via `next/font/google`, applied through `--font-sans` CSS variable on `<html>`.
- **next-themes** wraps the app (`components/theme-provider.tsx`). Dark mode is class-based.
- **Google Maps** via `@vis.gl/react-google-maps`. Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_ID` in `.env.local`. Falls back to a static illustrated map if the API fails or is blocked.

### auth-server
- **Express 5** with ESM modules (`"type": "module"`).
- **Mongoose** for MongoDB, **bcrypt** for password hashing, **jsonwebtoken** for tokens, **zod** for request validation.
- Path alias `#*` → `./src/*`. Entry: `src/app.ts`. Build output: `dist/`.
- TypeScript enforces `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
- Excluded from root `tsconfig.json` to avoid type bleed into the Next.js build.

### Data model note
A flare/event is a **single object** surfaced in two views: map (now/imminent) and calendar (upcoming). There is no separate "spontaneous" vs "planned" type — only timing determines which view it appears in.

## Auth
- v1: email/password. JWT tokens. Backend scaffolded in `auth-server/`.
- Phone number auth deferred to v2 (required for contact importing).

## Important: Next.js 16 breaking changes

Next.js 16 has API and convention changes that differ from common training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices.
