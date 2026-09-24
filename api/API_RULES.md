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
- Public events still require login. Anyone who can see a public event can join it by answering going or declined; people the host removed or who are blocked either way can't. Private events can only be answered by people on the guest list.
- When a host switches an event from public to private, guests who joined on their own and are `going` keep their spot; joiners who aren't going are dropped. Invited guests are never touched. Switching private to public keeps the invite list.
- Only the host can list, add and remove event guests. A removed guest can't see or rejoin the event, even a public one, until the host invites them again.
- Circles can only be managed by their owner.
- Circles are snapshots: sending a flare to a circle copies its members into the flare at that moment. The flare remembers which circles it was sent to (`invitedCircleIds`) only so the host can be asked whether someone added to the circle later should be invited too; that is always an explicit host action (`POST /events/:id/members`), never automatic. `GET /circles/:id/events` lists the owner's upcoming flares for a circle.
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
