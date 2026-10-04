# Flare Moments Direction

## Decision

Decided 2026-10-03 (Patrick), tracked in #370.

- Sponti is explained to signed-out visitors on a public `/welcome` page that
  leads into sign-up. The auth gate keeps the map closed to signed-out
  visitors; browsing the map before sign-up is a later, separate change (#389).
- Capturing flare art (sketch, collage, photo) is optional. With no art, the
  lighting moment's fuse runs along the flare's category icon.
- The lighting moment plays only after the api confirms the flare.
- First-friend onboarding (#124) and the composer layout (#311) are unparked.
  #311 takes in the capture step and the gesture to light a flare.

## Reason

Observing testers showed that people don't understand what Sponti is or how
to use it. The first-run intro (#313) only shows after an account exists, and
lighting a flare ended in a toast, so the core loop never landed.

A public page explains the app without changing who can load what. Making
capture optional keeps lighting a flare fast, and lets the lighting moment
ship without the flare art field in `api/`.

## Consequence

The flare moments change the composition and personality of the flare UI, not
its features: the intro, idea spots, QR connect, invite links, composer fields,
map pins and notification feed all stay. New surfaces ship behind flags in
`spa/lib/feature-flags.ts`. All haptics go through `spa/lib/haptics.ts`, and
flare art never replaces the map pin (#315).
