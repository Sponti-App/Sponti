# Create Event Frontend Wiring

The create-event screen lives in `spa/app/event/new/page.tsx`. It owns the
form state with local React state, fetches friends and circles on mount, then
submits through `spa/lib/api/events`.

## Form State

The page keeps draft fields locally with `useState`: mode, event type, title,
time range, location choice, guest limit, audience, invite toggles, and details.
On mount it loads:

- `fetchAcceptedConnections()` for the custom friend picker.
- `fetchMyCircles()` for existing audience choices.
- `createCircle()` only when the user names and saves a custom friend list.

## Backend Payload Mapping

`handleSubmit()` builds a `DraftEvent` from the form state, resolves an
`EventAudienceTarget`, computes the exact ISO time range, and calls:

```ts
createEvent(createEventRequestFromDraft(draft, eventAudience, timeRange))
```

`createEventRequestFromDraft()` maps the draft into the backend `POST /events`
shape:

- title/details -> `title` and nullable `description`
- event type -> `type`
- time range -> `startAt` and `endAt`
- location picker -> `locationName`, `locationAddress`, and GeoJSON `location`
- visibility and invite toggles -> `visibility` and `allowGuestInvites`
- guest limit -> `guestInviteLimit`
- audience -> `circles` or `members`; public events send no invite targets

The backend responds with `{ event, members }` inside the API `data` envelope.
`createEvent()` unwraps that response correctly. The create form uses the
resolved promise as the success signal, then routes to `/event`, where hosted
and invited flares are loaded from backend event APIs.

## Why Adapters Exist

The adapters keep UI/prototype shapes separate from backend API contracts.
`events.adapter.ts` converts backend events to `EventItem` for map/calendar UI
and converts `DraftEvent` into `CreateEventRequest` for event creation. This
lets the form stay focused on UI state while the API module owns naming,
defaults, invite modes, and backend payload structure.

## Temporary Or Mocked Pieces

- The place search in `page.tsx` still uses `MOCK_PLACE_RESULTS`.
- `TEMP_EVENT_LOCATION_FALLBACK` supplies fixed coordinates until Places/Maps
  provides real selected-location data.
- `/event` uses `GET /api/v1/events/mine/upcoming` for the "your flares"
  dashboard. The local hosted-event store has been removed.
