# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **multi-context**: a single product split across `spa/` (frontend), `api/` (core business logic), and `auth-server/` (authentication). Each is its own context with its own domain language.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- The per-context **`CONTEXT.md`** for the package(s) you're touching — `spa/CONTEXT.md`, `api/CONTEXT.md`, `auth-server/CONTEXT.md`.
- **`docs/decisions/`** — system-wide architectural decisions for this repo (this is where ADRs live; the repo predates the `docs/adr/` convention). In addition, check `<package>/docs/adr/` for any context-scoped decisions.
- **`docs/architecture/`** and **`docs/flows/`** — system-level architecture write-ups and user-flow docs worth scanning when relevant.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT-MAP.md                     ← points to each context's CONTEXT.md (created lazily)
├── docs/
│   ├── decisions/                     ← system-wide decisions (existing ADR home)
│   ├── architecture/                  ← system architecture write-ups
│   └── flows/                         ← user-flow docs
├── spa/
│   ├── CONTEXT.md                     ← frontend domain language
│   └── docs/adr/                      ← frontend-specific decisions
├── api/
│   ├── CONTEXT.md                     ← core business-logic domain language
│   └── docs/adr/                      ← api-specific decisions
└── auth-server/
    ├── CONTEXT.md                     ← auth domain language
    └── docs/adr/                      ← auth-specific decisions
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids. Sponti's core vocabulary — e.g. a **flare** (the single event object surfaced in both map and calendar views), **circles**/friend lists, **quiet hours** — is canonical; see `CLAUDE.md` and `BRAND.md` until per-context glossaries exist.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing decision in `docs/decisions/` (or a package's `docs/adr/`), surface it explicitly rather than silently overriding:

> _Contradicts the "app shell owns bottom nav" decision — but worth reopening because…_
