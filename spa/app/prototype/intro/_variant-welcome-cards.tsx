"use client"

// PROTOTYPE (#373) — /welcome, approach A: a short card carousel. One idea
// per card, each with a real UI fragment, swipe or "next", and the sign-up
// buttons on the last card. ?cards=3 is the loop only; ?cards=4 adds who sees
// it, the privacy card.

import { useRef, useState } from "react"
import {
  ArrowRightIcon,
  GlobeIcon,
  LockIcon,
  UsersIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { PEOPLE, mockFlares } from "./_mock"
import {
  AuthCtas,
  BrandMark,
  InkButton,
  JoinCard,
  MapGrid,
  MiniComposer,
  PinPatch,
  Progress,
  type StepProps,
} from "./_shared"

type Card = {
  id: string
  title: string
  body: string
  Fragment: (p: StepProps) => React.ReactNode
}

const LIGHT: Card = {
  id: "light",
  title: "light a flare",
  body: "doing something now or later today? say what, when and where. a few taps and it's out.",
  Fragment: () => (
    <MiniComposer
      title="drinks at the canal"
      type="drinks"
      when="now · 2h"
      where="admiralbrücke"
      who="friends"
      className="w-full"
    />
  ),
}

const SEE: Card = {
  id: "see",
  title: "your people see it",
  body: "it shows up on their map, only for the friends you choose. nobody else sees it.",
  Fragment: ({ now }) => {
    const [canal, climb, pho] = mockFlares(now)
    return (
      <PinPatch
        event={canal}
        others={[climb, pho]}
        now={now}
        className="w-full"
      />
    )
  },
}

const WHO: Card = {
  id: "who",
  title: "you choose who sees it",
  body: "all your friends, one circle or a few people. invite only, or open to all.",
  Fragment: () => <WhoFragment />,
}

const JOIN: Card = {
  id: "join",
  title: "they join",
  body: "one tap and they're in. you see who's coming and how far away they are.",
  Fragment: ({ now }) => <JoinFragment now={now} />,
}

function JoinFragment({ now }: { now: number }) {
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

function WhoFragment() {
  const rows = [
    { icon: UsersIcon, label: "all friends", selected: false },
    { icon: UsersIcon, label: "climbing crew", selected: true },
    { icon: UsersIcon, label: "pick people", selected: false },
  ]
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-background p-3 shadow-(--shadow-card)">
      <div className="flex flex-col gap-1">
        {rows.map(({ icon: Icon, label, selected }) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
              selected
                ? "bg-card font-semibold text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
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

export function cardsFor(count: "3" | "4"): Card[] {
  return count === "4" ? [LIGHT, SEE, WHO, JOIN] : [LIGHT, SEE, JOIN]
}

export function welcomeCardsSteps(count: "3" | "4") {
  return cardsFor(count).length
}

export function WelcomeCards(props: StepProps) {
  const { state, go, stub } = props
  const cards = cardsFor(state.cards)
  const index = Math.min(state.s, cards.length - 1)
  const card = cards[index]
  const last = index === cards.length - 1
  const touchX = useRef<number | null>(null)

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
      <header className="flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))]">
        <BrandMark />
        <button
          type="button"
          onClick={() => stub("→ /login")}
          className="min-h-11 text-sm font-medium text-muted-foreground"
        >
          sign in
        </button>
      </header>
      <div className="pt-3">
        <Progress count={cards.length} index={index} />
      </div>

      <div key={card.id} className="proto-in flex flex-1 flex-col">
        <div className="relative mt-6 flex max-h-[26rem] min-h-64 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card px-4 py-6">
          <MapGrid />
          <div className="relative w-full">
            <card.Fragment {...props} />
          </div>
        </div>
        <div className="mt-6">
          <h1 className="text-lg font-semibold">{card.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
        </div>
      </div>

      <div className="mt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {last ? (
          <AuthCtas stub={stub} />
        ) : (
          <InkButton onClick={() => go(index + 1)}>
            next
            <ArrowRightIcon className="size-4" />
          </InkButton>
        )}
      </div>
    </div>
  )
}
