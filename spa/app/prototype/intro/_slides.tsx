"use client"

// PROTOTYPE (#373) — the intro slides, round 2. They say what sponti is and
// what it's for, and show the two kinds of flare: "right now" and "pick a
// time" (soon). They end on the map, not on sign-up: a visitor looks around
// first and is asked for an account when they light a flare.
//
// A: three slides. what it's for → now or soon (the composer's real tabs
//    switch the fragment) → they join.
// B: four slides. what it is → right now → soon → who sees it (the privacy
//    slide, to compare against leaving privacy until the sign-up ask).
// C: one screen. now and soon side by side, three goal lines, go.

import { useRef, useState } from "react"
import {
  ArrowRightIcon,
  BellIcon,
  CalendarBlankIcon,
  GlobeIcon,
  LockIcon,
  MapTrifoldIcon,
  UsersIcon,
} from "@/components/icons"
import { FlarePreviewCard, timeLeftLabel } from "@/components/map-flare-pin"
import { cn } from "@/lib/utils"
import { BERLIN, PEOPLE, SOON, mockFlares } from "./_mock"
import {
  BrandMark,
  CalendarRow,
  InkButton,
  JoinCard,
  MapGrid,
  PeachButton,
  PersonAvatar,
  PinPatch,
  Progress,
  TextButton,
  WhenTabs,
} from "./_shared"

type Slide = {
  id: string
  title: string
  body: string | ((mode: Mode) => string)
  Fragment: (p: FragmentProps) => React.ReactNode
}
type Mode = "now" | "scheduled"
type FragmentProps = {
  now: number
  mode: Mode
  setMode: (m: Mode) => void
}

// ---- fragments --------------------------------------------------------------

function LivePatch({ now }: FragmentProps) {
  const [canal, climb, pho] = mockFlares(now)
  return (
    <PinPatch
      event={canal}
      others={[climb, pho]}
      now={now}
      className="w-full"
    />
  )
}

/** "right now": the real preview card of a live flare. */
function LiveCard({ now }: { now: number }) {
  const [canal] = mockFlares(now)
  return (
    <div className="flex justify-center">
      <FlarePreviewCard
        event={canal}
        own={false}
        user={BERLIN}
        now={now}
        onClose={() => {}}
      />
    </div>
  )
}

/** "pick a time": calendar rows. */
function SoonRows({ now, className }: { now: number; className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {SOON.map(({ flare, day }, i) => (
        <CalendarRow
          key={day}
          event={flare(now)}
          day={day}
          time={i === 0 ? "14:00" : "20:30"}
        />
      ))}
    </div>
  )
}

function NowOrSoon(p: FragmentProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <WhenTabs value={p.mode} onChange={p.setMode} />
      <div key={p.mode} className="proto-in">
        {p.mode === "now" ? <LiveCard now={p.now} /> : <SoonRows now={p.now} />}
      </div>
    </div>
  )
}

function JoinFragment({ now }: FragmentProps) {
  const [joined, setJoined] = useState(false)
  const [canal] = mockFlares(now)
  return (
    <JoinCard
      event={canal}
      host={PEOPLE.mia}
      joined={joined}
      onJoin={() => setJoined(true)}
      goingPeople={[PEOPLE.jonas, PEOPLE.lena, PEOPLE.sam]}
      className="w-full"
    />
  )
}

function People() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex -space-x-3">
        {Object.values(PEOPLE).map((p) => (
          <PersonAvatar key={p.name} person={p} className="size-14" />
        ))}
      </div>
      <span className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground shadow">
        mia: drinks at the canal, who&apos;s in?
      </span>
    </div>
  )
}

function WhoFragment() {
  const rows = ["all friends", "climbing crew", "pick people"]
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-background p-3 shadow-(--shadow-card)">
      <div className="flex flex-col gap-1">
        {rows.map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
              i === 1
                ? "bg-card font-semibold text-primary"
                : "text-muted-foreground"
            )}
          >
            <UsersIcon className="size-4" />
            {label}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-border/60 pt-3 text-xs">
        <span className="flex flex-1 items-center gap-1.5 rounded-full bg-flare-invite px-3 py-1.5 text-flare-invite-ink">
          <LockIcon className="size-3.5" />
          invite only
        </span>
        <span className="flex flex-1 items-center gap-1.5 rounded-full bg-flare-open px-3 py-1.5 text-flare-open-ink">
          <GlobeIcon className="size-3.5" />
          open to all
        </span>
      </div>
    </div>
  )
}

// ---- takes -----------------------------------------------------------------

const TAKE_A: Slide[] = [
  {
    id: "a-what",
    title: "get your people out, today",
    body: "sponti shows what your friends are up to, on a map. no group chat, no planning thread.",
    Fragment: LivePatch,
  },
  {
    id: "a-kinds",
    title: "right now, or soon",
    body: (mode) =>
      mode === "now"
        ? "right now: you're heading out within the hour. it's live on your friends' map."
        : "pick a time: later today or this week. it waits in their calendar, then goes live.",
    Fragment: NowOrSoon,
  },
  {
    id: "a-join",
    title: "they tap in",
    body: "one tap to join. you see who's coming, and nobody else gets a ping.",
    Fragment: JoinFragment,
  },
]

const TAKE_B: Slide[] = [
  {
    id: "b-what",
    title: "sponti is for getting out with friends",
    body: "light a flare when you're up for something. friends who are free join you.",
    Fragment: () => <People />,
  },
  {
    id: "b-now",
    title: "right now",
    body: "heading out in the next hour? a right now flare is live on your friends' map until it ends.",
    Fragment: ({ now }) => <LiveCard now={now} />,
  },
  {
    id: "b-soon",
    title: "soon",
    body: "planning for later? pick a time and it sits in their calendar until it starts.",
    Fragment: ({ now }) => <SoonRows now={now} />,
  },
  {
    id: "b-who",
    title: "only who you pick",
    body: "all your friends, one circle or a few people. invite only, or open to all.",
    Fragment: () => <WhoFragment />,
  },
]

export function slidesFor(take: "A" | "B" | "C"): { id: string }[] {
  if (take === "C") return [{ id: "c-one" }]
  return take === "A" ? TAKE_A : TAKE_B
}

// ---- screens ---------------------------------------------------------------

export function Slides({
  take,
  index,
  now,
  go,
  onDone,
  onSignIn,
}: {
  take: "A" | "B" | "C"
  index: number
  now: number
  go: (i: number) => void
  /** "look around": to the map. */
  onDone: () => void
  onSignIn: () => void
}) {
  if (take === "C")
    return <OneScreen now={now} onDone={onDone} onSignIn={onSignIn} />
  const slides = take === "A" ? TAKE_A : TAKE_B
  return (
    <Carousel
      slides={slides}
      index={Math.min(index, slides.length - 1)}
      now={now}
      go={go}
      onDone={onDone}
      onSignIn={onSignIn}
    />
  )
}

function Carousel({
  slides,
  index,
  now,
  go,
  onDone,
  onSignIn,
}: {
  slides: Slide[]
  index: number
  now: number
  go: (i: number) => void
  onDone: () => void
  onSignIn: () => void
}) {
  const [mode, setMode] = useState<Mode>("now")
  const touchX = useRef<number | null>(null)
  const slide = slides[index]
  const last = index === slides.length - 1
  const body = typeof slide.body === "function" ? slide.body(mode) : slide.body

  return (
    <div
      className="flex min-h-dvh flex-col bg-background px-6"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (dx <= -48 && !last) go(index + 1)
        else if (dx >= 48 && index > 0) go(index - 1)
      }}
    >
      <header className="flex items-center justify-between pt-3">
        <BrandMark />
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 text-sm font-medium text-muted-foreground"
        >
          skip
        </button>
      </header>
      <div className="pt-3">
        <Progress count={slides.length} index={index} />
      </div>

      <div key={slide.id} className="proto-in flex flex-1 flex-col">
        <div className="relative mt-6 flex max-h-[26rem] min-h-72 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card px-4 py-6">
          <MapGrid />
          <div className="relative w-full">
            <slide.Fragment now={now} mode={mode} setMode={setMode} />
          </div>
        </div>
        <div className="mt-6">
          <h1 className="text-lg font-semibold">{slide.title}</h1>
          <p className="mt-2 min-h-10 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {last ? (
          <PeachButton onClick={onDone}>
            look around
            <ArrowRightIcon className="size-4" />
          </PeachButton>
        ) : (
          <InkButton onClick={() => go(index + 1)}>
            next
            <ArrowRightIcon className="size-4" />
          </InkButton>
        )}
        <TextButton onClick={onSignIn}>i have an account</TextButton>
      </div>
    </div>
  )
}

function OneScreen({
  now,
  onDone,
  onSignIn,
}: {
  now: number
  onDone: () => void
  onSignIn: () => void
}) {
  const [canal] = mockFlares(now)
  const [soon] = SOON
  const goals = [
    { Icon: MapTrifoldIcon, text: "see what friends are up to, on a map" },
    { Icon: CalendarBlankIcon, text: "right now, or at a time you pick" },
    { Icon: BellIcon, text: "one tap to join, no group-chat noise" },
  ]
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6">
      <header className="flex items-center justify-between pt-3">
        <BrandMark />
      </header>
      <div className="proto-in flex flex-1 flex-col justify-center py-6">
        <h1 className="text-lg font-semibold">
          light a flare, see who&apos;s in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          sponti gets friends together with less planning. a flare says what
          you&apos;re up to, and when.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              right now
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-l-[3px] border-border border-l-accent bg-card p-3">
              <span className="flex w-14 shrink-0 items-center gap-1.5 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                live
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{canal.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  by mia · ends in{" "}
                  {timeLeftLabel(new Date(canal.endAt).getTime() - now)}
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              pick a time
            </p>
            <CalendarRow event={soon.flare(now)} day={soon.day} time="14:00" />
          </div>
        </div>
        <ul className="mt-6 flex flex-col gap-2.5">
          {goals.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              {text}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <PeachButton onClick={onDone}>
          look around
          <ArrowRightIcon className="size-4" />
        </PeachButton>
        <TextButton onClick={onSignIn}>i have an account</TextButton>
      </div>
    </div>
  )
}
