# Notifications Flow

The in-app notification feed opens from the shared authenticated bottom nav.
`AuthenticatedAppShell` owns the feed state, popover, and unread badge wiring so
the behavior is consistent across authenticated app pages.

## User Flow

- The Feed item in `BottomNav` shows the backend unread count.
- Tapping Feed opens `NotificationsPopover` from the shared app shell.
- Opening the popover fetches the latest notification page.
- The feed renders read and unread notifications together, newest first.
- Displayed unread notifications are marked read through the read-batch flow.
- Clicking a notification closes the popover and routes to `notification.href`.

## Implementation Files

- `spa/components/authenticated-app-shell.tsx` owns shared popover state,
  `useNotifications()`, and `BottomNav` unread props.
- `spa/lib/use-notifications.ts` owns the in-memory notification cache,
  pagination state, unread-count refresh, and read-batch updates.
- `spa/components/notifications-popover.tsx` renders the fixed popover above the
  shared nav.
- `spa/components/bottom-nav.tsx` displays the unread badge passed in by the
  shell.
- `spa/lib/api/notifications.ts` calls `GET /notifications`,
  `GET /notifications/unread-count`, and `PATCH /notifications/read-batch`.

## Notes

The badge source is `GET /notifications/unread-count`. The feed should not infer
badge state by counting loaded feed items because the user can have unread items
outside the currently loaded page.
