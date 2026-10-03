"use client"

// PROTOTYPE (#373) — map coach marks, three at most, in the loop's order:
// the flare button (light) → a pin or idea spot (they see) → the bell (they
// join). ?spot=idea is a new account's quiet map (idea spots only);
// ?spot=pin is a map with friends' flares.
//
// after:  the location ask comes first, so the marks point at a map that is
//         already around you.
// before: the marks run over a map with no position yet (a default area),
//         and the location ask comes last, as the map's sheet.

import { DEFAULT_AREA, ideasNear, mockFlares } from "./_mock"
import { LocationAsk, MapLocationSheet } from "./_variant-location"
import { CoachMark, MapScreen, type StepProps } from "./_shared"

export const COACH_STEPS = 5

const MARKS = {
  flare: {
    title: "light a flare",
    body: "tap here to tell your people what you're up to, now or later today.",
  },
  idea: {
    title: "ideas nearby",
    body: "no flares around yet? the dashed spots are ideas. tap one and it's a flare in two taps.",
  },
  pin: {
    title: "a friend's flare",
    body: "plum is invite only, teal is open to all. tap it to see who's going and join.",
  },
  bell: {
    title: "joins land here",
    body: "when someone joins your flare or invites you, it shows up here.",
  },
} as const

export function CoachMarks({ state, now, go }: StepProps) {
  const after = state.v !== "before"
  const withFlares = state.spot === "pin"
  const located = after ? true : state.s >= 4
  const flares = withFlares ? mockFlares(now) : []
  const ideas = ideasNear(DEFAULT_AREA.center, now)

  // Which screen this step is.
  const markIndex = after ? state.s - 1 : state.s
  const askStep = after ? state.s === 0 : state.s === 3
  const done = state.s === 4

  if (after && askStep)
    return <LocationAsk onAllow={() => go(1)} onPickArea={() => go(1)} />

  const order = ["flare", withFlares ? "pin" : "idea", "bell"] as const
  const markKey = !askStep && !done ? order[markIndex] : null
  const target = markKey === "pin" || markKey === "idea" ? "spot" : markKey

  return (
    <div data-coach-root className="relative overflow-hidden">
      <MapScreen
        now={now}
        areaLabel={located ? "near you" : "berlin"}
        located={located}
        flares={flares}
        ideas={ideas}
      >
        {!after && askStep && (
          <>
            <div className="absolute inset-0 z-10 bg-black/20" />
            <MapLocationSheet onAllow={() => go(4)} onPick={() => go(4)} />
          </>
        )}
      </MapScreen>
      {markKey && target && (
        <CoachMark
          target={target}
          index={markIndex}
          count={3}
          title={MARKS[markKey].title}
          body={MARKS[markKey].body}
          onNext={() => go(state.s + 1)}
          onSkip={() => (after ? go(4) : go(3))}
        />
      )}
    </div>
  )
}
