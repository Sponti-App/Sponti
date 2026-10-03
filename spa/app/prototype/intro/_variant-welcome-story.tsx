"use client"

// PROTOTYPE (#373) — /welcome, approach B: one scrolling page. The loop as
// three numbered beats down a line, each with its UI fragment, a short "you
// stay in control" block, and the sign-up buttons pinned to the bottom the
// whole time. No steps to click through: you scroll.

import { useState } from "react"
import { LockIcon, UsersIcon } from "@/components/icons"
import { PEOPLE, mockFlares } from "./_mock"
import {
  AuthCtas,
  BrandMark,
  JoinCard,
  MiniComposer,
  PinPatch,
  type StepProps,
} from "./_shared"

export const WELCOME_STORY_STEPS = 1

function Beat({
  n,
  title,
  body,
  children,
  last = false,
}: {
  n: number
  title: string
  body: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <section className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
          {n}
        </span>
        {!last && <span className="mt-2 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1 pb-10">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  )
}

export function WelcomeStory({ now, stub }: StepProps) {
  const [joined, setJoined] = useState(false)
  const [canal, climb, pho] = mockFlares(now)
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <BrandMark />
        <button
          type="button"
          onClick={() => stub("→ /login")}
          className="min-h-11 text-sm font-medium text-muted-foreground"
        >
          sign in
        </button>
      </header>

      <div className="flex-1 px-6 pt-8">
        <h1 className="text-lg font-semibold">get your people out, today</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          sponti is for plans that happen now or soon. no group chat, no
          planning. it works like this:
        </p>

        <div className="mt-8">
          <Beat
            n={1}
            title="light a flare"
            body="say what you're up to, when and where. a few taps and it's out."
          >
            <MiniComposer
              title="drinks at the canal"
              type="drinks"
              where="admiralbrücke"
              who="friends"
            />
          </Beat>
          <Beat
            n={2}
            title="your people see it"
            body="it pops up on their map, only for the friends you choose."
          >
            <PinPatch event={canal} others={[climb, pho]} now={now} />
          </Beat>
          <Beat
            n={3}
            title="they join"
            body="one tap and they're in. you see who's coming and how far away they are."
            last
          >
            <JoinCard
              event={canal}
              host={PEOPLE.mia}
              joined={joined}
              onJoin={() => setJoined(true)}
              goingPeople={[PEOPLE.jonas, PEOPLE.lena, PEOPLE.sam]}
            />
          </Beat>
        </div>

        <section className="border-t border-border/60 pt-6 pb-8">
          <h2 className="text-base font-semibold">you stay in control</h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <UsersIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
              send a flare to all your friends, one circle or a few people
            </li>
            <li className="flex gap-3">
              <LockIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
              invite only by default. open it to all when you want company
            </li>
          </ul>
        </section>
      </div>

      <div className="sticky bottom-0 border-t border-border/60 bg-background/95 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <AuthCtas stub={stub} />
      </div>
    </div>
  )
}
