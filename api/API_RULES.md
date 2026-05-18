# API Rules

## Security

- All `/api/v1/*` routes require a Bearer access token.
- `/health` is public.
- Access tokens are verified with `ACCESS_JWT_SECRET`.
- Sensitive ownership fields must come from the JWT, not the request body.
- Unknown body/query/param fields are rejected by strict Zod schemas.
- User passwords and refresh tokens are never exposed or managed here.

## Response Shape

Success:

```json
{ "data": {} }
```

Paginated success:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Error:

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": []
  }
}
```

## Authorization

- Event updates and cancellations are host-only.
- Private events are visible only to the host and invited members.
- Public events still require login.
- Circles can only be managed by their owner.
- Circle members must be accepted directional connections of the owner.
- Blocks are stealthy: blocked invitation attempts return a generic processed response.

## Blocks

When A blocks B:

- Create `blocks` document `A -> B`.
- Delete A's directional connection to B.
- Delete pending B -> A requests so A does not receive them.
- Remove B from A's circles.
- Do not remove B from events.
- Filter B's events from A's map/calendar/inbox results.

## QR Contact Tokens

- QR tokens are random bearer secrets; store only `tokenHash`.
- Tokens expire after 15 minutes and can be reused until expiry.
- Creating a new token does not deactivate older unexpired tokens, so an in-flight
  scan does not break if the owner refreshes or reopens the QR sheet.
- Resolving a token returns a confirmation payload. It creates a connection only
  when the caller passes `connect: true`.
- If either user blocked the other, resolving returns a generic not-found error.

## TODO Areas

- Connection retry behavior after rejection.
- Future pagination for inbox.
- Future custom index/migration strategy.
