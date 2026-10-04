# Flare Moments Direction

## Decision

Decided 2026-10-03 (Patrick), tracked in #370. Updated 2026-10-04 with the
first prototype picks.

- Signed-out visitors can open the map and idea spots before signing up
  (#389). Sign-up is asked for when they try to light a flare. This replaces
  the 2026-10-03 call to keep the map closed behind a public `/welcome` page.
- The onboarding runs in this order:
  1. Intro slides about what Sponti is and what it is for, including the two
     kinds of flare: "right now" and "soon" (a picked time in the near
     future).
  2. The map, with coach marks (#379).
  3. The location ask, inside the map's sheet (#408).
  4. Sign-up, when the visitor lights their first flare.
  5. After sign-up, a checklist in the map sheet replaces the three-slide
     intro (#377). Its friend-count call to action stays.
- Capturing flare art (sketch, collage, photo) is optional. With no art, the
  lighting moment's fuse runs along the flare's category icon.
- The lighting moment plays only after the api confirms the flare. Its motion
  is still open (#371): the strike swipe and the burst stay; the scaled-up
  category icon and a fuse that traces both the inner and outer edge of the
  stroke do not.
- The first-join moment (#374, #380):
  - It is the arc: the friend's avatar pops up with a label, then arcs into
    the bell with a spark trail. It lasts 2.5 s.
  - Later joins swing the bell.
  - It plays on whatever screen the host is on, also when the flare has
    started or ended.
  - The flare detail sheet always sits above the bottom nav, so the bell
    stays in view.
  - Joins that arrive within a few seconds of each other stack into one
    overlay that names everyone. Joins further apart queue.
  - With reduced motion, the overlay fades in, holds and fades out, and the
    bell gets a static highlight.
  - Haptics: `success` on the first join and `light` on later ones.
- First-friend onboarding (#124) and the composer layout (#311) are unparked.
  #311 takes in the capture step and the gesture to light a flare.

## Reason

Observing testers showed that people don't understand what Sponti is or how
to use it. The first-run intro (#313) only shows after an account exists, and
lighting a flare ended in a toast, so the core loop never landed.

Letting visitors look around first shows them what Sponti is instead of
telling them, and asks for an account only when they want to do something
with it. Making capture optional keeps lighting a flare fast, and lets the
lighting moment ship without the flare art field in `api/`.

## Consequence

The flare moments change the composition and personality of the flare UI, not
its features: the intro, idea spots, QR connect, invite links, composer fields,
map pins and notification feed all stay. New surfaces ship behind flags in
`spa/lib/feature-flags.ts`. All haptics go through `spa/lib/haptics.ts`, and
flare art never replaces the map pin (#315).

The auth gate opens the map to signed-out visitors, so everything the map
loads for them has to work without a token and show no private flares.
