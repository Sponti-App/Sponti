# Sponti — Brand & Design Brief

A one-page reference for designers, engineers, and anyone touching Sponti's surface area.
For deep implementation guidance see [CLAUDE.md](./CLAUDE.md). For raw tokens see [spa/app/globals.css](./spa/app/globals.css).

---

## 1. What Sponti is

A social meetup app that lowers the friction of getting friends together — for things happening **right now** and **soon**. The signature gesture is "lighting a flare": broadcasting a plan to your circles and letting them tap in. Map = now, calendar = upcoming, both the same event seen differently.

Differentiators: low notification noise, granular per-circle privacy, fast creation.

---

## 2. Voice & tone

- **Lowercase by default.** Headings, labels, button text — all lowercase. Sentence case only in user-generated content.
- **Short, casual, action-oriented.** "light a flare", "flares near you", "by Sarah", "ending in 42 min".
- **No marketing-speak.** Don't say "spontaneous meetups" — say "what's happening now". Don't say "platform" — say "Sponti".
- **Time is human.** "in 42 min", "ending in 1h 20m", "tomorrow", "fri 22" — never raw timestamps in product copy.

---

## 3. Color

A neutral base lets one warm accent carry all the brand weight. The CTA color is **saturated peach**, identical in light and dark mode so a flare always reads as a flare.

### CTA & emphasis (both modes)

| Token | oklch | Approx hex |
|---|---|---|
| `--primary`, `--accent`, `--ring` | `oklch(0.8041 0.126 52.09)` | `#f8b187` |
| `--primary-foreground`, `--accent-foreground` | `oklch(0.25 0.06 50)` | `#3a2418` |

Use on: primary CTAs (light a flare, join), the live/active indicator strip, the "going" badge, focus rings.
Do not use as: page backgrounds, large fills, body text.

### Light mode

| Token | oklch | Role |
|---|---|---|
| `--background` | `oklch(0.97 0.015 346)` | Pale pink-cream page bg |
| `--foreground` | `oklch(0.25 0.06 346)` | Dark warm text |
| `--card` | `oklch(0.99 0.007 346)` | Near-white card surface |
| `--secondary` | `oklch(0.8451 0.0972 53.3)` | Soft peach (lighter than primary) |
| `--muted` | `oklch(0.93 0.02 346)` | Chip/input fill |
| `--muted-foreground` | `oklch(0.50 0.04 346)` | Secondary text |
| `--border` | `oklch(0.88 0.025 346)` | Hairlines |
| `--destructive` | `oklch(0.58 0.22 27)` | Delete, error |

### Dark mode

| Token | oklch | Role |
|---|---|---|
| `--background` | `oklch(0.2178 0.0145 266.91)` | Ink-black (cool navy) page bg |
| `--foreground` | `oklch(0.96 0.02 60)` | Warm cream text |
| `--card` | `oklch(0.3082 0.0255 262.72)` | Navy-tinted card (sits above bg) |
| `--secondary` | `oklch(0.2704 0.0212 257.28)` | Dark navy (segmented controls, tabs) |
| `--muted` | `oklch(0.28 0.02 266)` | Chip/input fill |
| `--muted-foreground` | `oklch(0.74 0.025 60)` | Secondary text |
| `--border` | `oklch(0.35 0.025 266)` | Hairlines |
| `--destructive` | `oklch(0.62 0.22 22)` | Delete, error |

---

## 4. Typography

**One family: Bricolage Grotesque.** Loaded via `next/font/google` in [spa/app/layout.tsx](./spa/app/layout.tsx) and bound to `--font-sans`. Used for everything — headings, body, labels, UI chrome.

Strict 4-step scale. Hierarchy comes from **weight and color**, not from inventing intermediate sizes.

| Role | Tailwind | Size | Weight |
|---|---|---|---|
| Title (screen, drawer, modal) | `text-lg` | 18 px | 600 |
| Heading (cards, section) | `text-base` | 16 px | 600 |
| Body / input / label | `text-sm` | 14 px | 400 / 500 |
| Meta / caption / chip | `text-xs` | 12 px | 400 |

**Minimum mobile size: 12 px.** Never `text-[10px]` / `text-[11px]` in product UI. If something feels like it needs to be smaller, drop **contrast** (`text-muted-foreground/70`) instead of size.

---

## 5. Layout & spacing

- **Use the Tailwind scale.** No arbitrary `mt-[15px]`, `gap-[14px]`.
- **Rhythm over uniformity.** Tight inside a group (`gap-2`), loose between groups (`mt-4`), very loose between zones (`mt-6` / `mt-8`).
- **Zones, not cards.** A screen breaks into zones (header / mode switcher / form / action bar). Mark boundaries with `border-b border-border/60`, not nested cards.
- **One radius.** `--radius: 0.5rem` (8 px). Derived sizes via `--radius-sm`/`md`/`lg`/`xl`/`2xl`.

---

## 6. Component conventions

Built on **shadcn (Nova preset)** + **Radix UI** + **Tailwind v4** + **Lucide icons**.

| Pattern | Implementation |
|---|---|
| Primary CTA | `bg-accent text-accent-foreground` (peach) |
| Live / active indicator | `border-l-[3px] border-l-accent` on the card |
| "Going" badge | Small `bg-accent/15 text-accent` pill |
| Segmented control | Radix `Tabs` with `h-8`/`h-9` `TabsList` — active = `bg-card text-primary` |
| Selected day / tab | `bg-card text-primary` (subtle, not full accent) |
| Ended / past | `bg-muted/30` surface, `text-muted-foreground` text, no border strip |
| Mode toggles (`week/month`, `map/calendar`) | Pill chips with `bg-card text-primary` active state |
| Filter chips | Outline by default, `bg-accent text-accent-foreground` when on, "× clear" appears only when ≥1 active |
| FAB (map view) | `h-14 w-14 rounded-full bg-accent` floating right, above bottom sheet |
| Sheets / drawers | Rounded-top `rounded-t-3xl`, `bg-background`, `shadow-(--shadow-sheet)` |

---

## 7. Design principles

1. **One accent.** The peach is precious — every screen should have at most one primary peach surface visible at a time.
2. **Quiet hierarchy.** Differentiate by **weight** and **color**, not by adding sizes. Three sizes per screen, max (16 / 14 / 12).
3. **No card-on-card.** A card already lifts off the bg; nesting another card inside creates visual noise. Use a border or spacing instead.
4. **Past states recede.** Ended events go muted and behind a fold. "0 going" is hidden, not displayed.
5. **Time is dominant for live, distance for upcoming.** Meta lines lead with what the user needs first: `by Sarah · 0.5 mi · ending in 42 min`.
6. **Empty states earn their space.** Dashed borders are reserved for true placeholders / draft slots, not for soft CTAs that have a clear primary action.
7. **Lowercase, always.** It's the brand.

---

## 8. Imagery & iconography

- **Icons:** Lucide React, default 16–20 px in product chrome, 24 px for FAB.
- **Avatars:** circular, generated initials over a host-color bg (used on map markers and event hosts).
- **No stock photography in-product.** Marketing surfaces only.
- **Map markers** use the host's color as a circle fill — distinct from the brand peach so brand and identity don't collide on the map.

---

## 9. What to avoid

- Stock shadcn neutral palette (we override `--accent`).
- Multiple accent CTAs visible simultaneously.
- Serif fonts in any context.
- Title case or ALL CAPS in product copy (except acronyms like RSVP).
- Cards nested inside cards.
- Borders used decoratively rather than to mark zone boundaries.
