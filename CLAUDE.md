# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

Standard Next.js app at the repo root, with separate backend workspaces alongside it:

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router pages and layouts |
| `components/` | React components (`ui/` for shadcn primitives) |
| `lib/` | Shared utilities (`utils.ts` — `cn` helper) |
| `hooks/` | Custom React hooks |
| `auth-server/` | Auth backend — Express 5 + MongoDB (own `package.json`) |
| `api/` | Future API workspace (placeholder) |
| `spa/` | Future SPA workspace (placeholder) |

## Commands

### Frontend (repo root)
```bash
npm run dev          # Next.js dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier (ts/tsx)
npm run typecheck    # tsc --noEmit
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
- **Next.js 16** (App Router) with React 19.
- **Tailwind CSS v4** via PostCSS (`@tailwindcss/postcss`).
- **shadcn/ui** with `radix-nova` style; add components via `npx shadcn add <component>`. Path aliases: `@/components/ui`, `@/lib`, `@/hooks`.
- **next-themes** wraps the app (`components/theme-provider.tsx`). Dark mode is class-based.

### auth-server
- **Express 5** with ESM modules (`"type": "module"`).
- **Mongoose** for MongoDB, **bcrypt** for password hashing, **jsonwebtoken** for tokens, **zod** for request validation.
- Path alias `#*` → `./src/*`. Entry: `src/app.ts`. Build output: `dist/`.
- TypeScript enforces `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.

## Important: Next.js 16 breaking changes

Next.js 16 has API and convention changes that differ from common training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices.
