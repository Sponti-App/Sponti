# SPA

The Next.js (App Router) presentation layer, wrapped in Capacitor for native. It renders what `api/` and `auth-server/` return and holds no business rules of its own: the server decides, the SPA shows. Sponti's UI copy is lowercase (see `BRAND.md`).

## Language

**Flare**:
The single event object a user lights, shown on the map (now / soon) and in the calendar (upcoming). Timing alone decides where it appears. The code and api still call it an event (`EventItem`, `HostedEvent`, `ApiEvent`); the UI says flare.
_Avoid_: Meetup, hangout, post, plan (when referring to the object).

**Live**:
A flare that has started and not yet ended (`isLive`, `deriveStatus`). A flare's display bucket is one of `live`, `upcoming`, `past` or `cancelled`. On the map a live flare's pin gets the peach ring, a pulse and a "live" chip; peach means live and nothing else.
_Avoid_: Active (the api's stored status, `ApiEventStatus`, which says nothing about timing).

**Right now / pick a time**:
The composer's two ways to time a flare (`DraftEvent.mode`: `now` or `scheduled`). "Right now" offers a short start delay (now, 15m, 30m, 1h) and "how long?" chips; "pick a time" offers a date and time. Both produce the same flare.
_Avoid_: Spontaneous vs planned flare (there are no two types).

**Composer**:
The bottom drawer where a flare is lit (`new-event-drawer.tsx`, opened from the bottom nav's flare button). It can open prefilled (`ComposerPrefill`: title, category, place), for example from an idea spot.
_Avoid_: Creator, new-event form.

**Category**:
A flare's type, one of `EventType`: hang out, drinks, food, party, sports, culture, hobby (`EVENT_TYPES` in `types/utils.ts`). Its icon is the flare's pin icon.
_Avoid_: Tag, kind.

**Invite only / open to all**:
The two labels for a flare's visibility (`private` / `public`). On the map pin, plum is invite only and teal is open to all.
_Avoid_: Private/public flare (in UI copy).

**Circle**:
A user-owned grouping of connections, used as the audience when lighting a flare. System circles are `close`, `inner` and `all`; the rest are `custom` (`CircleType`). `api/` owns them (see `docs/decisions/circles-and-users-are-api-owned.md`); the SPA only reads and edits them through `lib/api/circles.ts`.
_Avoid_: List, friend list, group.

**Connection**:
An accepted, mutual friend relationship, as the api defines it. Added in person by **QR code** (15 min, connects instantly) or by **invite link** (7 days, sends a request), both in `lib/contact-links.ts`. Signed-out visitors may open both link paths; they see who wants to connect with sign in and create account as equal choices, both keeping the way back (#441).
_Avoid_: Friend (as a stored entity), follower, contact.

**Idea spot**:
A curated Berlin place offered as a one-tap flare when the map is quiet (`FlareIdea` in `lib/flare-ideas.data.ts`, picked by `getIdeasNear`). It carries a title, category, place and an optional yearly season window read on the Berlin calendar, and it opens the composer prefilled. It shows as an idea pin and, on a quiet map, an idea card. "Hide ideas" is a device-only setting (`lib/idea-preferences.ts`). The list is a draft with no owner yet.
_Avoid_: Suggestion, recommendation, demo flare (idea spots are not flares and are never stored).

**Quiet map**:
The state where exactly one category chip is on and no flare of that category is live (`quietFlareType`), once location and results are loaded. The map then offers an idea card, or a generic card when ideas are hidden, and the bottom nav's flare button shows that category's icon.

**Feature profile**:
The compile-time switch in `lib/feature-flags.ts`: `tester` (the default; anything but `NEXT_PUBLIC_FEATURE_PROFILE=full` is tester, so a bad env fails closed) or `full`. Flags hide surfaces and never delete them: `reshare`, `plusOne` and `browseBeforeSignup` are on only in `full`. The e2e suite runs a second dev server in the `full` profile for the specs in `e2e/full-profile/`. `seedDemoData` is separate, off unless `NEXT_PUBLIC_SEED_DEMO_DATA=true`, and swaps real flares for bundled demo ones; the two never mix.
_Avoid_: Feature toggle, remote config (nothing is changed at runtime).

**First-run intro**:
The three-screen intro shown once per device over the first map after an account is created, ending in "add your first friend" or "light your first flare" depending on friend count (`first-run-intro.tsx`, state in `lib/onboarding.ts`, localStorage only). Signing in on an existing account never shows it.
_Avoid_: Tutorial, walkthrough.

**App shell**:
`AuthenticatedAppShell`, which renders the bottom nav, the unread badge and the notifications sheet once for every authenticated page. Pages never render `BottomNav` themselves (`docs/decisions/app-shell-owns-bottom-nav.md`). The one exception is the signed-out map, which renders `SignedOutBottomNav`: it holds no app-level state, and its tabs open that page's sign-up sheet.

**Signed-out map**:
The home map a visitor sees before signing up, behind `browseBeforeSignup` (#389): idea spots and open-to-all pins from the public map endpoint (`lib/api/public-map.ts`), centred on berlin, with "sign in" where settings sits. It calls no endpoint that needs an account. A pin, the nav's tabs, the flare button, the FAB and an idea's "light a flare" each open the **sign-up sheet**.
_Avoid_: Guest mode, preview, welcome page.

**Kept draft**:
The flare a signed-out visitor started (an idea spot, or a blank flare), kept in sessionStorage across sign-up or sign-in (`lib/kept-flare-draft.ts`). The auth pages return them to `/?resume=flare`, where the welcome back offers it once and opens the composer with it. Only the idea's id is stored.

**Feed**:
The in-app notifications list, shown in the notifications sheet from the bottom nav, with swipe and chip actions on rows (accepting a connection offers circle chips). This is all there is today: device push is not built, and the SPA registers no device token.
_Avoid_: Push notification, alert, popover (the old name).

**Haptic**:
A touch or vibration cue. Every one goes through `lib/haptics.ts` (Capacitor in the native app, `navigator.vibrate` on Android web, silent on iPhone Safari), never a direct call.

**Icon**:
Phosphor icons, imported only from `components/icons.tsx`; ESLint blocks importing an icon package anywhere else.
