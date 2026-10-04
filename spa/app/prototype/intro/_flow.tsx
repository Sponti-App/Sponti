"use client"

// PROTOTYPE (#373) — round 2 as one clickable flow, signed out → signed in:
//
//   slides → the map with coach marks → the location ask in the map's sheet
//   → browse → the sign-up ask when lighting a flare → back in the composer
//   with the draft → the checklist in the map's sheet.
//
// Every screen is a step (`?s=`), so the bar can jump anywhere and ← / →
// walk the whole thing; the buttons on each screen follow the real branches
// (deny location, pick an area, cancel, not now, later).

import { useState } from "react"
import { QuietFlareCard } from "@/components/map-view"
import { FLARE_IDEAS } from "@/lib/flare-ideas.data"
import type { FlareIdea } from "@/lib/flare-ideas"
import type { GeoCoords } from "@/lib/geolocation"
import { EVENT_TYPES } from "@/types/utils"
import {
  AREAS,
  BERLIN,
  DEFAULT_AREA,
  awayArea,
  ideasNear,
  nearestIdea,
  ownFlare,
} from "./_mock"
import { ChecklistDock, FirstFriend } from "./_after-signup"
import { ComposerSheet, GateSheet, RegisterScreen, type Draft } from "./_gate"
import { AreaBanner, BrowserPrompt, LocationSheet } from "./_location"
import {
  CoachMark,
  MapDock,
  MapScreen,
  type ProtoState,
  type Step,
  type StepProps,
} from "./_shared"
import { Slides, slidesFor } from "./_slides"

// ---- steps -----------------------------------------------------------------

export function flowSteps(state: ProtoState): Step[] {
  const slides = slidesFor(state.slides).map((_, i) => ({
    key: `slide-${i + 1}`,
    label: String(i + 1),
    stage: "slides",
  }))
  const steps: Step[] = [
    ...slides,
    { key: "mark-1", label: "1", stage: "marks" },
    { key: "mark-2", label: "2", stage: "marks" },
    { key: "mark-3", label: "3", stage: "marks" },
    { key: "ask", label: "ask", stage: "location" },
    { key: "prompt", label: "prompt", stage: "location" },
    { key: "area", label: "denied", stage: "location" },
    { key: "browse", label: "map", stage: "browse" },
    { key: "idea", label: "idea", stage: "browse" },
  ]
  if (state.at === "light")
    steps.push({ key: "draft", label: "composer", stage: "sign-up" })
  if (state.gate === "sheet")
    steps.push({ key: "gate", label: "ask", stage: "sign-up" })
  steps.push(
    { key: "register", label: "register", stage: "sign-up" },
    { key: "back", label: "composer", stage: "after" },
    { key: "checklist", label: "checklist", stage: "after" }
  )
  if (state.friends === "0")
    steps.push(
      { key: "friend", label: "friend", stage: "after" },
      { key: "done", label: "done", stage: "after" }
    )
  return steps
}

// ---- where the map is ------------------------------------------------------

type Place = {
  label: string
  center: GeoCoords
  located: boolean
  /** A picked area, for the banner. */
  area: string | null
  berlin: boolean
}

function placeOf(loc: string): Place {
  if (loc.startsWith("away:")) {
    const away = awayArea(loc.slice(5))
    return {
      label: away.name,
      center: away.center,
      located: false,
      area: away.name,
      berlin: false,
    }
  }
  const area = AREAS.find((a) => a.id === loc)
  if (area)
    return {
      label: area.name,
      center: area.center,
      located: false,
      area: area.name,
      berlin: true,
    }
  // "near you": the prototype pretends you're in kreuzberg.
  return {
    label: "near you",
    center: DEFAULT_AREA.center,
    located: true,
    area: null,
    berlin: true,
  }
}

function draftOf(state: ProtoState, place: Place, now: number): Draft {
  if (state.idea === "none") return { idea: null }
  const picked = FLARE_IDEAS.find((i) => i.id === state.idea)
  return { idea: picked ?? nearestIdea(place.center, now) }
}

/** The flare a blank draft becomes. */
const BLANK: FlareIdea = {
  id: "blank",
  title: "hanging out, who's in?",
  category: "hangout",
  place: { name: "my location", lat: 52.4986, lng: 13.403 },
}

// ---- coach marks -----------------------------------------------------------

const MARKS = {
  spot: {
    title: "ideas nearby",
    body: "no flares around yet? the dashed spots are ideas. tap one to make it your flare.",
  },
  flare: {
    title: "light a flare",
    body: "say what you're up to, right now or at a time you pick.",
  },
  calendar: {
    title: "soon lives here",
    body: "the map shows what's on now. flares with a picked time wait in the calendar.",
  },
  tabs: {
    title: "live or soon",
    body: "switch between what's on now and what's coming up later.",
  },
} as const

const MARK_SETS = {
  A: ["spot", "flare", "calendar"],
  B: ["flare", "spot", "tabs"],
} as const

// ---- the flow --------------------------------------------------------------

export function Flow({ state, now, go, stub }: StepProps) {
  const [account, setAccount] = useState<string | null>(null)
  const s = state.s
  const place = placeOf(state.loc)
  const ideas = place.berlin ? ideasNear(place.center, now) : []
  const draft = draftOf(state, place, now)
  const toGate = (patch: { idea: string }) =>
    go(
      state.at === "light"
        ? "draft"
        : state.gate === "sheet"
          ? "gate"
          : "register",
      patch
    )
  const signIn = () => stub("→ /login, and back to this map")

  // Slides.
  if (s.startsWith("slide-")) {
    const index = Number(s.slice(6)) - 1
    return (
      <Slides
        take={state.slides}
        index={index}
        now={now}
        go={(i) => go(`slide-${i + 1}`)}
        onDone={() => go("mark-1")}
        onSignIn={signIn}
      />
    )
  }

  // The signed-out map before the location ask: berlin, no position.
  if (s.startsWith("mark-") || s === "ask" || s === "prompt" || s === "area") {
    const markIndex = s.startsWith("mark-") ? Number(s.slice(5)) - 1 : -1
    const set = MARK_SETS[state.marks]
    const mark = markIndex >= 0 ? set[markIndex] : null
    return (
      <MapScreen
        now={now}
        areaLabel="berlin"
        located={false}
        ideas={ideasNear(BERLIN, now)}
        fab={mark !== null}
        dock={mark ? undefined : <div />}
      >
        {mark && (
          <CoachMark
            target={mark}
            index={markIndex}
            count={set.length}
            title={MARKS[mark].title}
            body={MARKS[mark].body}
            onNext={() =>
              go(markIndex < set.length - 1 ? `mark-${markIndex + 2}` : "ask")
            }
            onSkip={() => go("ask")}
          />
        )}
        {!mark && (
          <>
            <div className="absolute inset-0 z-10 bg-black/20" />
            <LocationSheet
              key={s}
              denied={s === "area"}
              onAllow={() => go("prompt")}
              onPick={(loc) => go("browse", { loc })}
            />
          </>
        )}
        {s === "prompt" && (
          <BrowserPrompt
            onAllow={() => go("browse", { loc: "you" })}
            onBlock={() => go("area")}
          />
        )}
      </MapScreen>
    )
  }

  const banner = place.area ? (
    <AreaBanner name={place.area} onUseLocation={() => go("prompt")} />
  ) : undefined

  // Browsing, signed out.
  if (s === "browse" || s === "idea") {
    const tapped = s === "idea" ? draft.idea : null
    const type = tapped
      ? EVENT_TYPES.find((t) => t.value === tapped.category)
      : undefined
    return (
      <MapScreen
        now={now}
        areaLabel={place.label}
        located={place.located}
        ideas={ideas}
        banner={banner}
        selectedIdeaId={tapped?.id}
        onIdea={(idea) => go("idea", { idea: idea.id })}
        onFlare={() => toGate({ idea: "none" })}
        onAccountOnly={(what) =>
          what === "sign in" ? signIn() : setAccount(what)
        }
        dock={
          tapped && type ? (
            <div className="pb-3">
              <QuietFlareCard
                type={type}
                idea={tapped}
                center={place.center}
                onLight={() => toGate({ idea: tapped.id })}
                onDismiss={() => go("browse")}
                onHideIdeas={() => stub("hide ideas")}
              />
            </div>
          ) : place.berlin ? undefined : (
            <MapDock
              count={0}
              ideas={false}
              title="quiet around here"
              hint="no idea spots here yet: they're berlin-only for now. light a flare and your friends will see it."
            />
          )
        }
      >
        {account && (
          <GateSheet
            draft={null}
            reason={account}
            onSignUp={() => go("register", { idea: "none" })}
            onSignIn={signIn}
            onClose={() => setAccount(null)}
          />
        )}
      </MapScreen>
    )
  }

  // The composer, signed out (at=light), and the sign-up sheet.
  if (s === "draft" || s === "gate") {
    return (
      <MapScreen
        now={now}
        areaLabel={place.label}
        located={place.located}
        ideas={ideas}
        banner={banner}
        dock={<div />}
        fab={false}
      >
        {s === "draft" ? (
          <ComposerSheet
            draft={draft}
            signedIn={false}
            onLight={() => go(state.gate === "sheet" ? "gate" : "register")}
            onLater={() => go("browse")}
          />
        ) : (
          <GateSheet
            draft={draft}
            onSignUp={() => go("register")}
            onSignIn={signIn}
            onClose={() => go("browse")}
          />
        )}
      </MapScreen>
    )
  }

  if (s === "register")
    return (
      <RegisterScreen
        draft={draft}
        onBack={() => go("browse")}
        onDone={() => go("back")}
        onSignIn={signIn}
      />
    )

  // Signed in from here on.
  const flareIdea = draft.idea ?? BLANK
  const lit = state.flare === "lit"

  if (s === "back")
    return (
      <MapScreen
        now={now}
        areaLabel={place.label}
        located={place.located}
        ideas={ideas}
        signedIn
        dock={<div />}
        fab={false}
      >
        <ComposerSheet
          draft={draft}
          signedIn
          onLight={() => go("checklist", { flare: "lit" })}
          onLater={() => go("checklist", { flare: "later" })}
        />
      </MapScreen>
    )

  if (s === "friend")
    return (
      <FirstFriend onDone={() => go("done")} onLater={() => go("checklist")} />
    )

  // checklist / done
  const friends = s === "done" ? 1 : state.friends === "3" ? 3 : 0
  return (
    <MapScreen
      now={now}
      areaLabel={place.label}
      located={place.located}
      ideas={ideas.filter((i) => !lit || i.id !== flareIdea.id)}
      own={lit ? ownFlare(now, flareIdea) : undefined}
      signedIn
      onFlare={() => go("back", { flare: "later" })}
      dock={
        <ChecklistDock
          friends={friends}
          lit={lit}
          flareTitle={flareIdea.title}
          ideaTitle={nearestIdea(place.center, now).title}
          onAddFriend={() => go("friend")}
          onLight={() => go("back")}
          onHide={() => stub("hide the checklist")}
          onInvite={() => stub("invite lena to the flare (edit → who)")}
        />
      }
      fab={false}
    />
  )
}
