# Flare Lighting Motion

**Status: decided by Patrick on 2026-10-13. It is built behind the
`flareLightMoment` flag (#376). The flag is off in the tester build and on in
the `dev` branch's Vercel deploy.** The real-phone check in Safari and Chrome
is still to do. Until it has passed, the flag stays off for testers, and this
record changes if the check changes the direction.

## Decision

Decided 2026-10-13 (Patrick), from the takeover prototype (draft PR #576),
part of #370. This replaces the 2026-10-12 decision (the launch for the
first flare and the wick after it, from #371 and PR #571).

- Every flare plays one full-screen moment, take C, "night flare":
  - It covers the whole screen, the nav included.
  - The veil comes down: dark mode gets the night (the dark background), and
    light mode gets a lighter veil (the pale background at 82%).
  - The map zooms in and tilts back into a 3D view of the flare's spot.
  - The flare shoots up from its spot on a column of smoke and bursts high
    over the map into a peach bloom, which lights the map for a beat.
  - Sparks rain down as the flare's pin below catches. Then the map flattens,
    the veil lifts, and the moment's pin hands over to the map's own pin.
- The first flare gets the full burst, and every flare after gets the soft
  one: fewer sparks, one ring, fewer embers. The first-flare rule now only
  sizes the burst (`pickBurst`).
- No "lit" text and no big type. The only words are the flare's title and
  when ("live now", "in 15 min", "at 7:30 pm"), lowercase, in the app's
  18 px and 14 px styles.
- The pin carries the flare's category icon only, with no flame on it. Before
  it catches, it is the same circle unlit (card colour, muted icon).
- There is never a second pin. The moment's pin is the flare from its first
  frame. The map draws the new flare's pin hidden ("held") until the moment
  has landed on it, and then they swap in the same frame.
- The takeover starts at the strike, not after the api answers, and the map
  moves to the flare's spot then. The flare only goes up once the api has
  created it. Until then the unlit flare waits on its spot, breathing and
  crackling. If the api fails, the takeover fades out (320 ms), the map goes
  back, and the composer returns with the draft and the existing "couldn't
  light that flare" error. If the api takes longer than 12 s, the takeover
  steps aside, and the flare still lands on the map if it is created later.
- The spark, the bloom and the rings are peach, because peach means live
  (#315). The pin keeps its plum (invite only) or teal (open to all) fill.
- Reduced motion uses cross-fades only. Nothing travels, scales, tilts or
  flies, and the map is never transformed: the veil fades in, the lit pin and
  its text fade in on the flare's spot once the api has it, then everything
  fades back. The strike stays, because it is the input and not decoration.
- The strike gesture and the nav button's morph into the strike strip stay
  as they were (#376).

## Reason

On Patrick's real-phone test of the wick (2026-10-13), the wick played next
to the flare while the real map pin was already there, so there were two
pins for the length of the animation. It confused, and it didn't read as a
success. A full-screen beat, like a dating app's "it's a match", makes
lighting a flare the moment it should be. Holding the map's own pin until
the hand-over means there is only ever one pin.

Starting at the strike makes the strike feel instant. The gate keeps the
moment honest: nothing goes up until the flare exists.

## Consequence

- `spa/lib/motion/takeover.ts` holds the takeover as pure functions of time:
  the timeline, the api gate (`takeoverClock`), the camera and the frame.
  `takeover-canvas.ts` draws the sparks, smoke and glows on one canvas, and
  `tween.ts` holds the easing. `components/flare-takeover.tsx` is the layer
  that drives the takeover every animation frame.
- No animation library is used. GSAP and the old moment (`flare-moment.tsx`,
  `load-gsap.ts`) are gone, and the takeover is a plain import, so the strike
  never waits on a download. The `gsap` package is still listed in
  `package.json`, unused.
- The zoom and the tilt are a CSS transform on the home map's own layer,
  `[data-lighting-map]`. It is set every frame and cleared when the takeover
  ends. This works the same on the Google map (tiles, vector canvas and
  markers move together as one composited layer) and on the static fallback.
  It needs nothing from Google's camera (tilt exists only on vector maps)
  and no snapshot. The map is a little soft while zoomed, under the veil.
- `lib/lit-flare.ts` carries the moment's messages to the map:
  - `announceLitFocus` moves the map at the strike.
  - `announceLitFlare(event, { held: true })` adds the pin hidden.
  - `releaseLitPin` shows the pin after the hand-over.
  - A held pin shows anyway after 15 s.
- With no home map on screen (the composer opened from another page), the
  takeover plays the same way and its pin fades away at the end.
- The composer still fetches the person's hosted flares when it opens
  (upcoming, live, and ended in the last 14 days), and it plays the full
  burst only when those have loaded, there are none, and this device has
  never lit a flare. Someone whose last flare ended more than 14 days ago,
  using a new device, gets the full burst again.
- Burnout (ended flares fading from the map) is not built. Ended flares
  leave the map.
