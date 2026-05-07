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

Sponti's visual identity is built on the **shadcn Nova** component style (compact padding, reduced margins) with a **neutral** base color and a distinctive **warm-red** accent. Every artifact — React components, HTML mockups, presentations, documents — must follow these tokens and conventions.

**Keywords**: Sponti, branding, design system, Nova, shadcn, styling, brand colors, typography, visual identity, UI theming.

### Typography

**Font family:** Figtree — used for all text: headings, body, labels, UI chrome.

```css
--font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;
```

| Context | Weight | Size guidance |
|---------|--------|---------------|
| Display / Hero | 700 (Bold) | 32–48 px |
| Section heading | 600 (SemiBold) | 20–28 px |
| Subheading / Card title | 600 (SemiBold) | 16–18 px |
| Body / Paragraph | 400 (Regular) | 14–16 px |
| Caption / Helper text | 400 (Regular) | 12–13 px |
| Button / Label | 500 (Medium) | 14 px |

> **Fallback stack:** If Figtree is unavailable, fall back to the system sans-serif stack above. Never substitute a serif font.

### Color Tokens — Light Mode

All values use **oklch** to match shadcn's token convention. Hex equivalents are provided for non-CSS contexts (Figma, documents, presentations).

#### Core Neutrals (Nova Neutral base)

| Token | oklch | Hex | Usage |
|-------|-------|-----|-------|
| `--background` | `oklch(1 0 0)` | `#ffffff` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | `#171717` | Primary text |
| `--card` | `oklch(1 0 0)` | `#ffffff` | Card surfaces |
| `--card-foreground` | `oklch(0.145 0 0)` | `#171717` | Card text |
| `--popover` | `oklch(1 0 0)` | `#ffffff` | Popover surfaces |
| `--popover-foreground` | `oklch(0.145 0 0)` | `#171717` | Popover text |
| `--secondary` | `oklch(0.97 0 0)` | `#f5f5f5` | Secondary fills |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `#262626` | Text on secondary |
| `--muted` | `oklch(0.97 0 0)` | `#f5f5f5` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` | `#737373` | Descriptions, placeholders |
| `--border` | `oklch(0.922 0 0)` | `#e5e5e5` | Borders, dividers |
| `--input` | `oklch(0.922 0 0)` | `#e5e5e5` | Input borders |
| `--ring` | `oklch(0.708 0 0)` | `#a3a3a3` | Focus rings |

#### Primary (Dark-on-light)

| Token | oklch | Hex | Usage |
|-------|-------|-----|-------|
| `--primary` | `oklch(0.205 0 0)` | `#262626` | Buttons, active nav, strong emphasis |
| `--primary-foreground` | `oklch(0.985 0 0)` | `#fafafa` | Text on primary surfaces |

#### Accent — Sponti Warm Red

The hero color drawn from the app's identity. Use for CTAs, active markers, badges, and brand moments.

| Token | oklch | Hex | Usage |
|-------|-------|-----|-------|
| `--accent` | `oklch(0.55 0.19 25)` | `#c44040` | Active states, map pins, flare badges, selected tabs |
| `--accent-foreground` | `oklch(0.985 0 0)` | `#fafafa` | Text/icons on accent surfaces |

> **Note:** In the shadcn Nova defaults, `--accent` is a neutral hover surface. Sponti **overrides** this token to carry the brand red. If you need a neutral hover fill, use `--secondary` instead.

#### Destructive

| Token | oklch | Hex | Usage |
|-------|-------|-----|-------|
| `--destructive` | `oklch(0.577 0.245 27.325)` | `#e5484d` | Delete, error, destructive actions |

#### Chart Palette

| Token | oklch | Hex |
|-------|-------|-----|
| `--chart-1` | `oklch(0.646 0.222 41.116)` | `#e76f51` |
| `--chart-2` | `oklch(0.6 0.118 184.704)` | `#2a9d8f` |
| `--chart-3` | `oklch(0.398 0.07 227.392)` | `#264653` |
| `--chart-4` | `oklch(0.828 0.189 84.429)` | `#e9c46a` |
| `--chart-5` | `oklch(0.769 0.188 70.08)` | `#f4a261` |

### Color Tokens — Dark Mode

| Token | oklch | Hex |
|-------|-------|-----|
| `--background` | `oklch(0.145 0 0)` | `#171717` |
| `--foreground` | `oklch(0.985 0 0)` | `#fafafa` |
| `--card` | `oklch(0.205 0 0)` | `#262626` |
| `--card-foreground` | `oklch(0.985 0 0)` | `#fafafa` |
| `--popover` | `oklch(0.205 0 0)` | `#262626` |
| `--popover-foreground` | `oklch(0.985 0 0)` | `#fafafa` |
| `--primary` | `oklch(0.922 0 0)` | `#e5e5e5` |
| `--primary-foreground` | `oklch(0.205 0 0)` | `#262626` |
| `--secondary` | `oklch(0.269 0 0)` | `#404040` |
| `--secondary-foreground` | `oklch(0.985 0 0)` | `#fafafa` |
| `--muted` | `oklch(0.269 0 0)` | `#404040` |
| `--muted-foreground` | `oklch(0.708 0 0)` | `#a3a3a3` |
| `--accent` | `oklch(0.55 0.19 25)` | `#c44040` |
| `--accent-foreground` | `oklch(0.985 0 0)` | `#fafafa` |
| `--destructive` | `oklch(0.704 0.191 22.216)` | `#f87171` |
| `--border` | `oklch(1 0 0 / 10%)` | `rgba(255,255,255,0.1)` |
| `--input` | `oklch(1 0 0 / 15%)` | `rgba(255,255,255,0.15)` |
| `--ring` | `oklch(0.556 0 0)` | `#737373` |

### Radius

Nova uses a compact base radius. All derived radii scale from `--radius`.

```css
--radius: 0.625rem; /* 10px */
```

| Token | Formula | Computed |
|-------|---------|----------|
| `--radius-sm` | `--radius × 0.6` | 6 px |
| `--radius-md` | `--radius × 0.8` | 8 px |
| `--radius-lg` | `--radius` | 10 px |
| `--radius-xl` | `--radius × 1.4` | 14 px |
| `--radius-2xl` | `--radius × 1.8` | 18 px |

### Component Style Notes

- **Style preset:** `base-nova` (compact spacing, tighter padding).
- **Component library:** Radix UI primitives via shadcn.
- **Styling engine:** Tailwind CSS v4 with CSS-variable theming (`cssVariables: true`).
- **Icons:** Lucide React (default shadcn icon set).

### Quick-Reference: Applying the Brand

| Scenario | What to use |
|----------|-------------|
| Page / section background | `bg-background` (`#ffffff` / `#171717`) |
| Primary text | `text-foreground` |
| Muted / secondary text | `text-muted-foreground` |
| Primary button | `bg-primary text-primary-foreground` |
| Brand accent button / badge | `bg-accent text-accent-foreground` (warm red) |
| Neutral hover surface | `bg-secondary` |
| Card | `bg-card text-card-foreground` |
| Borders | `border-border` |
| Focus ring | `ring-ring` |
| Heading font | `font-sans font-semibold` (Figtree 600) |
| Body font | `font-sans font-normal` (Figtree 400) |

### Non-CSS Contexts (Figma, Docs, Presentations)

When working outside code — Figma, slide decks, PDFs, marketing materials — use the **hex values** from the tables above as the source of truth. Key values at a glance:

- **Background:** `#ffffff` (light) / `#171717` (dark)
- **Text:** `#171717` (light) / `#fafafa` (dark)
- **Accent (Sponti Red):** `#c44040`
- **Muted text:** `#737373`
- **Borders:** `#e5e5e5`
- **Font:** Figtree (all weights from 400–700)

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
