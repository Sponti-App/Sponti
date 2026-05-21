# App Shell Owns Bottom Nav

## Decision

Authenticated app chrome is owned by `AuthenticatedAppShell`.

`BottomNav`, the notification unread badge, and `NotificationsPopover` are
rendered once at the shared shell level instead of being rendered by individual
pages.

## Reason

The unread notification badge is app-level state. Keeping it on the homepage made
the badge appear only on `/` and disappear on pages that rendered `BottomNav`
without notification props.

## Consequence

Authenticated pages should not import or render `BottomNav` directly. If a route
needs different chrome behavior, add an explicit shell visibility rule and
document why.
