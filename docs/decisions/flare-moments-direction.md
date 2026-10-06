# Flare Moments Direction

## Decision

Decided 2026-10-03 (Patrick), tracked in #370. Updated 2026-10-04 with the
first prototype picks, and 2026-10-06 with the intro round 2 picks (#373,
PR #407), #425 and #426.

- Signed-out visitors can open the map and idea spots before signing up
  (#389). Sign-up is asked for when they try to light a flare. This replaces
  the 2026-10-03 call to keep the map closed behind a public `/welcome` page.
- Signed-out visitors also see "open to all" flares on the map (#425), through
  a public endpoint that returns only what a pin needs. Tapping one asks for
  sign-up; details need an account.
- The onboarding runs in this order:
  1. Three intro slides: what Sponti is, why it exists, and how lighting a
     flare works ("right now" or a picked time). They are calm, grainy,
     slowly animated gradients with abstract figures; round 3 of #373 settles
     the look. They end on "look around".
  2. The map, with coach marks (#379), set A: idea spot, flare button, then
     the map/calendar toggle. They run once, with no replay.
  3. The location ask, inside the map's sheet (#408), with "pick an area"
     when location is blocked.
  4. Sign-up, as a sheet over the map, asked on the tap that would light a
     flare. Feed, circles and my flares stay in the nav and open the same
     sheet. The draft is kept.
  5. An account with no friends adds its first friend (QR or invite link,
     #124) before the kept draft is lit.
  6. A checklist in the map sheet replaces the post-sign-up intro (#377). Its
     friend-count call to action stays.
- "All friends" flares pick up friends who connect while the flare is
  upcoming or live (#426). Custom circles stay a snapshot, and the host is
  offered anyone added later.
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
Open-to-all flares reach them only through the public map endpoint's minimal
projection (#425); the signed-in events endpoints stay behind auth.
