"use client"

// PROTOTYPE (#373) — how the post-sign-up intro (#313,
// components/first-run-intro.tsx) changes once /welcome has explained the
// loop. The friend-count call to action stays: no friends → add one (QR);
// friends → light a flare, prefilled with the nearest idea spot.
//
// today: what the current three slides say, against /welcome.
// A: one screen, no slides. The first-friend step is a step of its own,
//    then the first flare.
// B: no full-screen intro at all. A two-item checklist sits in the map's
//    sheet until both are done. Its button is ink, not peach: the nav's
//    flare button is already the screen's one peach surface.

import {
  CheckIcon,
  FlameIcon,
  LinkIcon,
  QrCodeIcon,
  XIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { DEFAULT_AREA, PEOPLE, YOU, ideasNear, nearestIdea } from "./_mock"
import {
  BrandMark,
  InkButton,
  MapScreen,
  MiniComposer,
  PeachButton,
  PersonAvatar,
  TextButton,
  type StepProps,
} from "./_shared"

// ---- today ------------------------------------------------------------------

const TODAY = [
  {
    title: "see flares near you",
    body: "the map shows what your friends are doing now or soon. tap a flare to see where it is and who's going.",
    verdict: "repeats /welcome “your people see it”",
    keep: false,
  },
  {
    title: "light a flare fast",
    body: "pick what, when and where. a few taps and it's out.",
    verdict: "repeats /welcome “light a flare”",
    keep: false,
  },
  {
    title: "choose who sees it",
    body: "send it to all your friends, one circle or just a few people. only they see it, and nobody else gets a ping.",
    verdict: "moves to /welcome (4-card or story)",
    keep: false,
  },
  {
    title: "add your first friend / light your first flare",
    body: "the final button, picked by friend count.",
    verdict: "stays",
    keep: true,
  },
]

export function IntroToday() {
  return (
    <div className="min-h-dvh bg-background px-6 pt-6 pb-10">
      <h1 className="text-lg font-semibold">the intro today (#313)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        three slides after sign-up, then one button. once /welcome explains the
        loop, the slides say it twice.
      </p>
      <ol className="mt-6 flex flex-col">
        {TODAY.map((s, i) => (
          <li
            key={s.title}
            className="flex gap-3 border-b border-border/60 py-4"
          >
            <span className="w-4 text-sm text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                  s.keep
                    ? "bg-accent/15 text-accent"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {s.keep ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <XIcon className="size-3" />
                )}
                {s.verdict}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---- shared steps -----------------------------------------------------------

/** The first-friend step: today's QrShareSheet plus the 7-day invite link
 * (#124), as one screen. */
function FirstFriend({
  onDone,
  onSkip,
}: {
  onDone: () => void
  onSkip: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6">
      <header className="flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-xs text-muted-foreground">
          add your first friend
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="min-h-11 text-sm font-medium text-muted-foreground"
        >
          later
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <FakeQr />
        <p className="mt-4 text-base font-semibold">@{YOU.handle}</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          flares only go to friends. show this to one: they scan it and
          you&apos;re connected.
        </p>
      </div>
      <div className="flex flex-col gap-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <InkButton onClick={onDone}>
          <LinkIcon className="size-4" />
          send an invite link instead
        </InkButton>
        <TextButton onClick={onDone}>
          prototype: pretend lena scanned it
        </TextButton>
      </div>
    </div>
  )
}

function FakeQr() {
  // A deterministic pattern; not a real code.
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21
    const y = Math.floor(i / 21)
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
    if (finder) {
      const fx = x > 13 ? x - 14 : x
      const fy = y > 13 ? y - 14 : y
      return (
        fx === 0 ||
        fx === 6 ||
        fy === 0 ||
        fy === 6 ||
        (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)
      )
    }
    return (x * 7 + y * 13 + x * y) % 3 === 0
  })
  return (
    <div className="rounded-2xl bg-card p-4 shadow-(--shadow-card)">
      <div
        aria-label="qr code"
        className="grid size-44 grid-cols-[repeat(21,1fr)]"
      >
        {cells.map((on, i) => (
          <span key={i} className={on ? "bg-foreground" : ""} />
        ))}
      </div>
    </div>
  )
}

/** The composer opened by "light your first flare", prefilled with the
 * nearest idea spot (firstFlarePrefill). */
function FirstFlareComposer({
  now,
  onDone,
}: {
  now: number
  onDone: () => void
}) {
  const idea = nearestIdea(DEFAULT_AREA.center, now)
  return (
    <MapScreen
      now={now}
      areaLabel="near you"
      ideas={ideasNear(DEFAULT_AREA.center, now)}
    >
      <div className="absolute inset-0 z-10 bg-black/30" />
      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-background px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet)">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <p className="px-1 text-xs text-muted-foreground">
          an idea nearby, ready to go. change anything.
        </p>
        <MiniComposer
          title={idea.title}
          type={idea.category}
          where={idea.place.name.toLowerCase()}
          who="all friends"
          className="mt-3 border-0 p-1 shadow-none"
          cta={
            <PeachButton onClick={onDone} className="mt-2">
              let&apos;s light it up
            </PeachButton>
          }
        />
      </div>
    </MapScreen>
  )
}

// ---- A: one screen ----------------------------------------------------------

export function introASteps(friends: "0" | "3") {
  return friends === "0" ? 4 : 2
}

export function IntroOneScreen({ state, now, go, stub }: StepProps) {
  const noFriends = state.friends === "0"
  const idea = nearestIdea(DEFAULT_AREA.center, now)

  if (noFriends && state.s === 1)
    return <FirstFriend onDone={() => go(2)} onSkip={() => stub("→ map")} />
  if (noFriends && state.s === 3)
    return (
      <FirstFlareComposer
        now={now}
        onDone={() => stub("→ lighting moment (#372)")}
      />
    )
  if (!noFriends && state.s === 1)
    return (
      <FirstFlareComposer
        now={now}
        onDone={() => stub("→ lighting moment (#372)")}
      />
    )

  const friendJustAdded = noFriends && state.s === 2
  const friends = noFriends
    ? friendJustAdded
      ? [PEOPLE.lena]
      : []
    : [PEOPLE.lena, PEOPLE.mia, PEOPLE.sam]

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6">
      <header className="flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))]">
        <BrandMark />
        <button
          type="button"
          onClick={() => stub("→ map")}
          className="min-h-11 text-sm font-medium text-muted-foreground"
        >
          skip
        </button>
      </header>
      <div
        key={state.s}
        className="proto-in flex flex-1 flex-col justify-center"
      >
        {friends.length > 0 ? (
          <div className="flex -space-x-2">
            {friends.map((p) => (
              <PersonAvatar key={p.name} person={p} className="size-12" />
            ))}
          </div>
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <FlameIcon className="size-6" />
          </span>
        )}
        <h1 className="mt-6 text-lg font-semibold">
          {friendJustAdded ? "lena's in" : `you're in, ${YOU.first}`}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {friendJustAdded
            ? "now there's someone to see your flare. light one and see if lena joins."
            : noFriends
              ? "flares go to your friends, so start with one. it takes a scan or a link."
              : "lena, mia and sam are already here. light your first flare and see who joins."}
        </p>
        {!noFriends || friendJustAdded ? (
          <p className="mt-6 rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">
            idea nearby: <span className="text-foreground">{idea.title}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {noFriends && !friendJustAdded ? (
          <PeachButton onClick={() => go(1)}>
            <QrCodeIcon className="size-4" />
            add your first friend
          </PeachButton>
        ) : (
          <PeachButton onClick={() => go(state.s + 1)}>
            <FlameIcon className="size-4" />
            light your first flare
          </PeachButton>
        )}
        <TextButton onClick={() => stub("→ map")}>maybe later</TextButton>
      </div>
    </div>
  )
}

// ---- B: checklist in the map sheet -----------------------------------------

export function introBSteps(friends: "0" | "3") {
  return friends === "0" ? 4 : 2
}

function ChecklistRow({
  n,
  done,
  current,
  title,
  hint,
}: {
  n: number
  done: boolean
  current: boolean
  title: string
  hint: string
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done
            ? "bg-foreground text-background"
            : current
              ? "border-2 border-foreground"
              : "border border-border text-muted-foreground"
        )}
      >
        {done ? <CheckIcon className="size-3.5" weight="bold" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            done ? "text-muted-foreground line-through" : "font-medium"
          )}
        >
          {title}
        </p>
        {!done && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </li>
  )
}

export function IntroChecklist({ state, now, go, stub }: StepProps) {
  const noFriends = state.friends === "0"
  const idea = nearestIdea(DEFAULT_AREA.center, now)

  if (noFriends && state.s === 1)
    return <FirstFriend onDone={() => go(2)} onSkip={() => go(0)} />
  if ((noFriends && state.s === 3) || (!noFriends && state.s === 1))
    return (
      <FirstFlareComposer
        now={now}
        onDone={() => stub("→ lighting moment (#372)")}
      />
    )

  const friendDone = !noFriends || state.s === 2
  return (
    <MapScreen
      now={now}
      areaLabel="near you"
      ideas={ideasNear(DEFAULT_AREA.center, now)}
      dock={
        <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-background px-4 pt-3 pb-4 shadow-(--shadow-sheet)">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold">two things to get going</p>
            <button
              type="button"
              aria-label="hide"
              onClick={() => stub("hide the checklist")}
              className="flex size-9 items-center justify-center text-muted-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <ol className="mt-1">
            <ChecklistRow
              n={1}
              done={friendDone}
              current={!friendDone}
              title="add your first friend"
              hint="flares only go to friends"
            />
            <ChecklistRow
              n={2}
              done={false}
              current={friendDone}
              title="light your first flare"
              hint={`idea nearby: ${idea.title}`}
            />
          </ol>
          <InkButton onClick={() => go(state.s + 1)} className="mt-3">
            {friendDone ? (
              <>
                <FlameIcon className="size-4" />
                light your first flare
              </>
            ) : (
              <>
                <QrCodeIcon className="size-4" />
                add your first friend
              </>
            )}
          </InkButton>
        </div>
      }
    />
  )
}
