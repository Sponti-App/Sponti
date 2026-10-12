# Flare Lighting Motion

**Status: approved by Patrick on 2026-10-12. It is built behind the
`flareLightMoment` flag (#375, #376), which is off in the tester build.** The
real-phone check in Safari and Chrome is still to do. Until it has passed,
the flag stays off for testers, and this record changes if the check changes
the direction.

## Decision

Decided 2026-10-12 (Patrick), from the motion prototype (#371, draft PR
#571), part of #370. Round 1 (PR #405) had already settled the gesture and
the burst, and dropped the scaled-up category icon and the stroke fuse that
traced both edges of the icon's stroke.

- Someone's first flare plays take C, "launch". The strike sends a spark up
  one curved trail. At the top it bursts into streaks around the flare's
  circle, and the light lights a tight, even ring of five dots one by one.
  The dots are abstract, not anyone's position. They pulse once, then fade
  away, and never stay as markers.
- Every flare after that plays take A, "wick". One rope runs from the strike
  up to the flare's circle. The spark burns the rope away and leaves nothing
  behind. A small flame catches on top of the circle and flickers while the
  flare is lit.
- In both takes the category icon stays at its natural 24px inside the
  flare's circle, and the fuse runs along one path.
- The gesture is the strike swipe: a fast flick along the strip lights the
  fuse, and a slow drag fizzles. Enter or space strikes from a keyboard.
- The flare catches only after the api confirms it. While the api is slow,
  the spark waits at the end of the fuse. If the api fails, the spark dies
  and the flare is unlit again.
- The first flare gets the full burst. Every flare after gets the soft burst.
- The spark, the small flame and the live ring are always peach, because
  peach means live (#315). The flare's body may take the pin colour (plum
  for invite only, teal for open to all) in both A and C.
- Burnout, the same in both takes: the small flame sinks out (A), the flare
  greys out to the muted state, then fades away until it is gone. No ash,
  smoke or ember is left behind to clash with the map underneath.
- Reduced motion uses cross-fades only. Nothing travels, scales, flickers or
  flies:
  - Lighting is a 200 ms cross-fade to a static lit state. In C, the dots
    fade in lit, then fade out.
  - Burnout is a 300 ms cross-fade to the muted state, then a fade to
    nothing.
  - The strike stays, because it is the input and not decoration.
- The motion uses GSAP with DrawSVGPlugin. They load with a dynamic
  `import()` only when a strike starts, about 29 KB gzipped (core with
  CSSPlugin about 27.6 KB, DrawSVG about 1.6 KB). None of it is in first-load
  JavaScript.
- GSAP's licence is free for this use, plugins included. gsap 3.15.0 ships
  under GreenSock's standard "no charge" licence, free for commercial use
  since the Webflow acquisition. Its only restriction is on building a no-code
  animation tool that competes with Webflow.

## Reason

Patrick found round 1's scaled-up icons and double-edged fuse weak. Icons
read well at event-type size, not as the hero shape.

The launch shows the core loop the first time someone lights a flare: their
flare goes up, and the light reaches others. Later flares need a quieter
moment, and the wick keeps the pin's circle with a clear "lit" flame on top.

Ash, trails and markers that stay behind could read as places or people on
the map, so the moment leaves nothing behind once it has played.

## Consequence

- The shared motion module, `spa/lib/motion/` (#375), holds the wick, the
  launch, the burst levels, burnout, the reduced-motion steps and the flare
  button's morph. Haptics go through `spa/lib/haptics.ts`.
- The lighting moment (#376) plays the launch only for a known first flare.
  When the composer opens it fetches the person's hosted flares (upcoming,
  live, and ended in the last 14 days). It plays the launch when those have
  loaded, there are none, and this device has never lit a flare. Anything
  unknown plays the wick. Someone whose last flare ended more than 14 days
  ago, using a new device, sees the launch again. An api count of all hosted
  flares would close that gap.
- The nav's round flare button morphs into the composer's strike strip when
  the composer opens, and back when it closes. A plain tap, Enter or Space
  also lights the flare, so the swipe is never the only way.
- The composer preloads the moment's code and GSAP when it opens, so the
  first strike doesn't wait on them.
- Burnout exists as a building block, but nothing plays it yet, because ended
  flares leave the map.
