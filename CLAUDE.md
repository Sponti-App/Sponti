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

#### The 4-step type scale (locked)

Sponti uses a strict 4-step scale. Hierarchy comes from **weight contrast**, not from inventing intermediate sizes. **No arbitrary sizes** (`text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`, etc.) — they fragment the scale and harm mobile readability.

| Role | Tailwind | Size | Weight | Tailwind weight | Usage |
|------|----------|------|--------|-----------------|-------|
| Display / Hero | `text-2xl` → `text-4xl` | 24–36 px | 700 | `font-bold` | Landing heroes, onboarding titles. Rare in product UI. |
| Title | `text-lg` | 18 px | 600 | `font-semibold` | Screen titles, drawer titles, modal titles |
| Heading | `text-base` | 16 px | 600 | `font-semibold` | Header chrome ("light a flare"), card titles, section headings |
| Body / Label | `text-sm` | 14 px | 400 / 500 | `font-normal` / `font-medium` | Inputs, paragraphs, form labels (500), button text (500) |
| Meta / Caption | `text-xs` | 12 px | 400 | `font-normal` | Hints, counters, chips, helper text, inferred badges |

**Minimum mobile size: 12 px.** Anything smaller is a bug — never use `text-[10px]` or `text-[11px]` in product UI. If something feels like it needs to be smaller than 12 px, lower the **color contrast** (e.g. `text-muted-foreground/70`) instead of shrinking the type.

#### Weight rules

- Body copy and input text: **400** (`font-normal`).
- Form labels and button text: **500** (`font-medium`).
- Titles, headings, emphasis: **600** (`font-semibold`).
- Reserve **700** (`font-bold`) for display-scale type only (24 px+). Never bold body text.
- Distinguish two pieces of meta on the same line by **color**, not size — same 12 px, lighter foreground for the secondary one.

#### Form screens (drawers, modals, settings)

- **Title bar:** `text-base font-semibold` (16/600).
- **Summary / preview chips** under the title: `text-xs` (12 px), centered, sit between the title row and the form body.
- **Section label:** `text-sm font-medium text-foreground` (14/500). Section labels are form questions — they belong at body size, not caption size.
- **Input text and placeholders:** `text-sm` (14/400).
- **Inline meta** below inputs (type hints, char counters, inferred badges, "+ add a note" affordances): `text-xs text-muted-foreground` (12/400).
- **Primary CTA:** `text-base` (16 px) — never smaller on the main action button.

Hierarchy on one screen should resolve into at most 3 sizes (16 / 14 / 12). Adding a 4th size to "fix" hierarchy is almost always solvable with weight or color instead.

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

### Layout & Spacing Rhythm

Hierarchy of spacing matters more than the absolute values. The single biggest tell of an AI-generated UI is **uniform vertical gaps** between every element — header, controls, sections all sitting at the same distance. A modern app uses **rhythm**: tight inside a group, loose between groups, very loose between major zones.

#### Spacing scale (locked)

Always use Tailwind's scale. No arbitrary `mt-[15px]`, `gap-[14px]`. The scale tokens:

| Token | px | Use for |
|-------|----|---------|
| `gap-1` / `mt-1` | 4 | Touching elements (icon + adjacent label) |
| `gap-2` / `mt-2` | 8 | Inside a tight group (label → input, chip → chip) |
| `gap-3` / `mt-3` | 12 | Inside a relaxed group |
| `gap-4` / `mt-4` | 16 | Between adjacent groups in the same zone |
| `mt-6` | 24 | Between sections within a form |
| `mt-8` | 32 | Between major zones on a screen |

If two values feel "close enough," pick the one further away — bigger gap means stronger separation, and ambiguity is exactly what makes a UI feel flat.

#### Zone model for screens

Every screen breaks into **zones**. A zone is a coherent block (header chrome, mode switcher, form body, action bar). Inside a zone, gaps are small. Between zones, gaps are large and often reinforced with a **`border-b border-border/60` divider** or a background tint.

Drawer / modal example (the `light a flare` pattern):

```
┌─ Header zone ────────────────────────────┐
│  [X]      light a flare                  │   tight: py-3 between rows
│           [chip] [chip] [chip]           │   chips sit inside header zone
├──────────────────────────────────────────┤   border-b border-border/60
│                                          │
│  [ tabs / segmented control ]            │   mt-4 below header border
│                                          │
│  what's the plan?                        │   Section: mt-4 below tabs
│  [ input                             ]   │   label → input: mt-2
│  type · hang out  change                 │   inline meta: mt-2
│                                          │
│  where do you want to meet?              │   Section: mt-6
│  ...                                     │
├──────────────────────────────────────────┤   border-t (pinned CTA zone)
│  [        light a flare        ]         │   primary action
└──────────────────────────────────────────┘
```

#### Form rules

- **Title bar + summary chips = one zone**, anchored with `border-b border-border/60`. Title and chips are tight (`pt-1 pb-3`) and centered.
- **Mode switcher (tabs / segmented control)** sits below the header border with `mt-4`. It belongs to the form, not the header — keep it visually close to the form body (gap below: `mb-2`, NOT a full section gap).
- **First Section after a tab**: `mt-4`, not `mt-6` — the tab is already the section's header.
- **Subsequent Sections in the same form**: `mt-6` between each.
- **Inside a Section**: label → input is `mt-2`; input → inline meta is `mt-2`; meta → next affordance is `mt-3`.
- **CTA bar** is pinned to the bottom and separated from form content by `border-t border-border` and its own internal padding.

#### Borders, separators, surfaces

- Use borders to **mark zone boundaries**, not to decorate. Light dividers: `border-border/60`. Strong: `border-border`.
- Don't wrap groups in `<Card>` unless they need an elevated surface. A border-bottom on a header is enough separation in a flat layout. Nested cards are a smell.
- Pinned bars (top app bar, bottom CTA) get `border-t` or `border-b` to anchor them to the viewport edge.

#### Tabs / segmented controls

- Reserve for **mode switching** of the same form (e.g. "right now" vs "pick a time"), not for navigation between unrelated screens.
- Keep the control compact: `h-9` or smaller. Active state uses `bg-card` (light) or `bg-secondary` (dark) — never the accent color (accent is for primary CTAs only).
- Place the tabs **adjacent to the form they control**. Don't leave a 24+ px gap below — that breaks the relationship.

#### The "modern app" smell test

A screen feels modern when:
1. You can identify zones at a glance (header / form / action).
2. Spacing inside each zone is visibly tighter than between zones.
3. No control floats alone — everything is near what it owns or affects.
4. The screen reads in **three** sizes max (16 / 14 / 12) with weight and color doing the rest.
5. The primary action is unambiguous (one accent-colored button, pinned).

If two of these are off, the screen will read as "AI-built template," even if every individual element is fine.

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
| Heading (16 px) | `text-base font-semibold` |
| Form section label (14 px) | `text-sm font-medium text-foreground` |
| Body / input (14 px) | `text-sm font-normal` |
| Meta / caption (12 px) | `text-xs text-muted-foreground` |

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
