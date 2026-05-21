# Authenticated App Shell

`spa/components/authenticated-app-shell.tsx` owns shared authenticated app chrome.
Pages inside the authenticated experience should render their content only; they
should not render `BottomNav` directly.

## Responsibilities

- Renders the single shared `BottomNav`.
- Mounts `useNotifications()` once at the app-shell level.
- Passes `notificationsUnread` from the backend unread-count cache into
  `BottomNav`.
- Owns `NotificationsPopover` open/close state and notification click routing.
- Closes the notification popover on route changes and when the new-event drawer
  opens.
- Keeps `BottomNav` in the same provider scope as `NewEventDrawerProvider`, so
  the "light a flare" action continues to use the global drawer.

## Route Visibility

The shell only shows chrome when `useAuth()` reports `authenticated`.

The shell hides chrome on:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/qr/*`
- `/event/new`
- `/api/*`

Public legal pages such as `/menu/terms` and `/menu/privacy` can render without
authenticated chrome for signed-out users. Signed-in users see the same shared
authenticated nav there as on other menu pages.

Profile pages (`/profile/[username]`) intentionally show the authenticated nav.
They are part of the signed-in app flow and should keep bottom padding or modal
z-indexes high enough that the fixed nav does not obscure content.

## Bottom Spacing And Nav Height

`BottomNav` writes its measured height to `--sponti-nav-h` on
`document.documentElement`. Components that sit near the nav should use this
variable instead of hard-coded nav heights when they need exact positioning.

Known dependents:

- `spa/components/map-view.tsx` positions the collapsed sheet and floating map
  buttons relative to `--sponti-nav-h`.
- `spa/components/notifications-popover.tsx` positions the popover above the nav
  with the same variable.

Pages with scrollable content should reserve enough bottom padding for the fixed
nav. Existing page-level padding such as `pb-28`, `pb-32`, or `pb-44` may remain
when it protects content or fixed page CTAs from the nav.

## Z-Index Expectations

- Shared bottom nav: `z-40`.
- Notification popover panel: `z-50`.
- Full-height drawers and modal sheets should render at `z-50` or above when
  they need to cover the nav.
- The map bottom sheet can cover the nav when expanded and sit above it by
  position when collapsed.
