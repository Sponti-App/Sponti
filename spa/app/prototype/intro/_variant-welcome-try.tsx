"use client"

// PROTOTYPE (#373) — /welcome, approach C: learn it by doing it. The visitor
// lights a pretend flare (what → when → light it), watches the fuse from #371
// in plain CSS, sees friends join on the map, then gets the sign-up buttons.
// Nothing is sent anywhere: it's a demo on mock data.

import { useState } from "react"
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  FlameIcon,
  MapPinIcon,
  UsersIcon,
} from "@/components/icons"
import { FlarePin } from "@/components/map-flare-pin"
import type { EventType } from "@/lib/api/events"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"
import { PEOPLE, demoFlare } from "./_mock"
import {
  AuthCtas,
  BrandMark,
  Fuse,
  InkButton,
  MapGrid,
  MapStreets,
  PeachButton,
  PersonAvatar,
  type StepProps,
} from "./_shared"

export const WELCOME_TRY_STEPS = 5

const WHEN = [
  { key: 0, label: "now" },
  { key: 30, label: "in 30 min" },
  { key: 60, label: "in 1h" },
]

const RECAP = [
  { icon: FlameIcon, label: "light a flare" },
  { icon: MapPinIcon, label: "your people see it on their map" },
  { icon: UsersIcon, label: "they join" },
]

const LOOP = ["light", "they see", "they join"] as const

function LoopMeter({ at }: { at: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {LOOP.map((label, i) => (
        <span
          key={label}
          className={cn(
            "flex items-center gap-1.5",
            i <= at ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              i < at ? "bg-foreground" : i === at ? "bg-accent" : "bg-border"
            )}
          />
          {label}
        </span>
      ))}
    </div>
  )
}

export function WelcomeTry({ state, now, go, stub }: StepProps) {
  const [type, setType] = useState<EventType>("drinks")
  const [when, setWhen] = useState(0)
  const step = state.s
  const typeLabel = EVENT_TYPES.find((t) => t.value === type)?.label ?? type

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6">
      <header className="flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))]">
        <BrandMark />
        <button
          type="button"
          onClick={() => (step < 4 ? go(4) : stub("→ /login"))}
          className="min-h-11 text-sm font-medium text-muted-foreground"
        >
          {step < 4 ? "skip" : "sign in"}
        </button>
      </header>
      <div className="pt-2">
        <LoopMeter at={step <= 1 ? 0 : step === 2 ? 1 : 2} />
      </div>

      <div key={step} className="proto-in flex flex-1 flex-col">
        {step === 0 && (
          <>
            <div className="mt-8">
              <p className="text-xs text-muted-foreground">try it</p>
              <h1 className="mt-1 text-lg font-semibold">
                what are you up to?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                sponti is for plans that happen now or soon. pick one and light
                a pretend flare.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setType(value)
                    go(1)
                  }}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm",
                    value === type
                      ? "border-transparent bg-card font-medium text-primary shadow-sm"
                      : "border-border text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="mt-8">
              <p className="text-xs text-muted-foreground">try it</p>
              <h1 className="mt-1 text-lg font-semibold">when?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {typeLabel}, with your friends. only they will see it.
              </p>
            </div>
            <div className="mt-6 flex gap-2">
              {WHEN.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWhen(w.key)}
                  className={cn(
                    "min-h-11 flex-1 rounded-full border text-sm",
                    w.key === when
                      ? "border-transparent bg-card font-medium text-primary shadow-sm"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center justify-center py-8">
              <Fuse type={type} lit={false} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Fuse type={type} lit />
              <h1 className="mt-6 text-lg font-semibold">it&apos;s lit</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                your friends see it on their map now. nobody else does.
              </p>
            </div>
          </>
        )}

        {step === 3 && <JoinStep now={now} type={type} when={when} />}

        {step === 4 && (
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-lg font-semibold">that&apos;s sponti</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              make an account to light a real one.
            </p>
            <ol className="mt-6 flex flex-col gap-3">
              {RECAP.map(({ icon: Icon, label }, i) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span className="flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-sm">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-muted-foreground">{i + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => go(0)}
              className="mt-4 flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-muted-foreground"
            >
              <ArrowCounterClockwiseIcon className="size-4" />
              try it again
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {step === 1 && (
          <PeachButton onClick={() => go(2)}>
            let&apos;s light it up
          </PeachButton>
        )}
        {(step === 2 || step === 3) && (
          <InkButton onClick={() => go(step + 1)}>
            next
            <ArrowRightIcon className="size-4" />
          </InkButton>
        )}
        {step === 4 && <AuthCtas stub={stub} />}
      </div>
    </div>
  )
}

function JoinStep({
  now,
  type,
  when,
}: {
  now: number
  type: EventType
  when: number
}) {
  const yours = demoFlare(now, type, when)
  const joins = [
    { who: PEOPLE.mia, eta: "8 min away" },
    { who: PEOPLE.jonas, eta: "15 min away" },
  ]
  return (
    <>
      <div className="mt-8">
        <h1 className="text-lg font-semibold">and they join</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          one tap for them. you see who&apos;s coming and when they&apos;ll get
          there.
        </p>
      </div>
      <div className="relative mt-6 h-44 overflow-hidden rounded-2xl border border-border bg-muted">
        <MapGrid className="opacity-30" />
        <MapStreets />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <FlarePin event={yours} own joined={false} now={now} />
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {joins.map(({ who, eta }, i) => (
          <li
            key={who.name}
            className="proto-in flex items-center gap-3 rounded-xl border-l-[3px] border-l-accent bg-card px-3 py-2"
            style={{
              animationDelay: `${300 + i * 500}ms`,
              animationFillMode: "both",
            }}
          >
            <PersonAvatar person={who} />
            <span className="flex-1 text-sm">
              <span className="font-medium">
                {who.name.split(" ")[0].toLowerCase()}
              </span>{" "}
              joined
            </span>
            <span className="text-xs text-muted-foreground">{eta}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
