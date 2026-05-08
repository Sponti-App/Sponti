# Sponti API Server

Main business API server for Sponti. Auth endpoints are intentionally not implemented here; use
`auth-server/` for register, login, logout, refresh tokens, passwords, and user identity.

## Setup

```bash
cd api
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

- `MONGO_URI`
- `DB_NAME`
- `PORT`
- `CLIENT_BASE_URL`
- `ACCESS_JWT_SECRET`

## Scripts

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run lint
npm run format
npm test
```

## Routes

Public:

- `GET /health`

Authenticated `/api/v1`:

- `POST /events`
- `GET /events`
- `GET /events/:eventId`
- `PATCH /events/:eventId`
- `PATCH /events/:eventId/cancel`
- `PATCH /events/:eventId/me`
- `GET /events/map/active`
- `GET /events/calendar/upcoming`
- `POST /connections/request`
- `GET /connections`
- `PATCH /connections/:id/respond`
- `DELETE /connections/:id`
- `POST /blocks/:userId`
- `DELETE /blocks/:userId`
- `GET /blocks`
- `GET /circles`
- `PATCH /circles/:id`
- `POST /circles/:id/members`
- `DELETE /circles/:id/members/:userId`
- `GET /notification-settings/me`
- `PATCH /notification-settings/me`
- `POST /qr-contact-tokens`
- `POST /qr-contact-tokens/resolve`
- `GET /inbox/me`
- `GET /users/search?q=<username-or-display-name>`

QR token routes currently return `501` until the frontend contract is finalized.

## Notes

- CORS allows `CLIENT_BASE_URL`.
- Responses use `{ data }` or `{ error }`.
- Validation errors return `400`.
- Duplicate Mongo keys return `409`.
- Invalid ObjectIds return `400`.
- Expired access tokens return `401` with `ACCESS_TOKEN_EXPIRED`.
