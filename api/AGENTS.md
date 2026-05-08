# AGENTS.md

This package is the main Sponti business API server.

- Read the repository root `CLAUDE.md` before making changes.
- Do not add auth endpoints here. Registration, login, logout, refresh tokens, passwords, and refresh token persistence belong to `auth-server/`.
- Run commands from this `api/` directory.
- Keep routes versioned under `/api/v1`.
- Use `req.user.id` from the access-token middleware for owner/host/requester fields. Never trust those values from request bodies.
- Keep QR token behavior scaffolded until the frontend/product contract is decided.
- Before finishing, run `npm run typecheck`, `npm run lint`, and relevant tests when dependencies are available.
