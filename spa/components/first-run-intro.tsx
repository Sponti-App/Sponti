"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowRightIcon,
  ClockIcon,
  FlameIcon,
  GlobeIcon,
  MapPinIcon,
  QrCodeIcon,
  UserCheckIcon,
  UsersIcon,
} from "@/components/icons"
import { useAuth } from "@/components/auth-provider"
import { ideaPrefill } from "@/components/map-view"
import type { ComposerPrefill } from "@/components/new-event-drawer"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { QrShareSheet } from "@/components/qr-share-sheet"
import { Button } from "@/components/ui/button"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import { getIdeasNearWidening } from "@/lib/flare-ideas"
import { readLastKnownCoords, type GeoCoords } from "@/lib/geolocation"
import { haptic } from "@/lib/haptics"
import { useIdeasHidden } from "@/lib/idea-preferences"
import { completeOnboarding, useShowOnboarding } from "@/lib/onboarding"

// #313: a short first-run intro, shown once per device right after a new
// account is made, over the first map. Three screens, a visible skip on each,
// and one peach call to action at the end chosen by how many friends the
// person already has.

export type FirstRunCta = "add-friend" | "light-flare"

/** No friends yet: add one first. Already connected: light a flare. */
export function pickFirstRunCta(connectionCount: number): FirstRunCta {
  return connectionCount > 0 ? "light-flare" : "add-friend"
}

/** The nearest idea spot to where the map last was, as a composer prefill,
 * or undefined (an empty composer) when there is none or ideas are off. */
export function firstFlarePrefill(
  center: GeoCoords | null,
  now: Date,
  ideasHidden: boolean
): ComposerPrefill | undefined {
  if (!center || ideasHidden) return undefined
  const [idea] = getIdeasNearWidening({
    center,
    now,
    limit: 1,
    minCandidates: 1,
  })
  return idea ? ideaPrefill(idea) : undefined
}

const SLIDES = [
  {
    id: "map",
    title: "see flares near you",
    body: "the map shows what your friends are doing now or soon. tap a flare to see where it is and who's going.",
    Illustration: MapIllustration,
  },
  {
    id: "light",
    title: "light a flare fast",
    body: "pick what, when and where. a few taps and it's out.",
    Illustration: ComposeIllustration,
  },
  {
    id: "audience",
    title: "choose who sees it",
    body: "send it to all your friends, one circle or just a few people. only they see it, and nobody else gets a ping.",
    Illustration: AudienceIllustration,
  },
] as const

const SWIPE_MIN_PX = 48

export function FirstRunIntro() {
  const show = useShowOnboarding()
  const [qrOpen, setQrOpen] = useState(false)
  const { user } = useAuth()

  if (qrOpen) {
    return createPortal(
      <div className="fixed inset-0 z-[55]">
        <QrShareSheet
          displayName={user?.displayName ?? "you"}
          handle={user?.username ?? "you"}
          onClose={() => setQrOpen(false)}
        />
      </div>,
      document.body
    )
  }
  if (!show) return null
  return createPortal(
    <IntroScreens onAddFriend={() => setQrOpen(true)} />,
    document.body
  )
}

function IntroScreens({ onAddFriend }: { onAddFriend: () => void }) {
  const { openDrawer } = useNewEventDrawer()
  const ideasHidden = useIdeasHidden()
  const [index, setIndex] = useState(0)
  // null while loading; a failed load counts as no friends yet.
  const [connectionCount, setConnectionCount] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchAcceptedConnections(controller.signal)
      .then((connections) => {
        if (!controller.signal.aborted) setConnectionCount(connections.length)
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnectionCount(0)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1
  const cta = connectionCount === null ? null : pickFirstRunCta(connectionCount)

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), SLIDES.length - 1)
    if (clamped === index) return
    haptic("selection")
    setIndex(clamped)
  }

  const skip = () => {
    haptic("light")
    completeOnboarding()
  }

  const finish = () => {
    if (!cta) return
    haptic("medium")
    completeOnboarding()
    if (cta === "add-friend") {
      onAddFriend()
    } else {
      openDrawer(
        firstFlarePrefill(readLastKnownCoords(), new Date(), ideasHidden)
      )
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") goTo(index + 1)
    else if (event.key === "ArrowLeft") goTo(index - 1)
    else if (event.key === "Escape") skip()
  }

  const Illustration = slide.Illustration

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="welcome to sponti"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[55] flex flex-col bg-background text-foreground outline-none"
    >
      <header className="flex shrink-0 items-center justify-between px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
            <FlameIcon className="size-3.5" />
          </span>
          <span className="text-sm font-semibold">sponti</span>
        </div>
        <button
          type="button"
          onClick={skip}
          className="min-h-11 px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          skip
        </button>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col px-6"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const dx = e.changedTouches[0].clientX - touchStartX.current
          touchStartX.current = null
          if (dx <= -SWIPE_MIN_PX) goTo(index + 1)
          else if (dx >= SWIPE_MIN_PX) goTo(index - 1)
        }}
      >
        <div
          className="flex gap-1.5 pt-3"
          role="progressbar"
          aria-label="intro progress"
          aria-valuemin={1}
          aria-valuemax={SLIDES.length}
          aria-valuenow={index + 1}
          aria-valuetext={`${index + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                i <= index ? "bg-foreground" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div
          key={slide.id}
          className="sponti-intro-slide flex min-h-0 flex-1 flex-col"
        >
          <div className="relative mt-6 min-h-40 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
            <Illustration />
          </div>

          <div className="mt-6" aria-live="polite">
            <h1 className="text-lg font-semibold">{slide.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{slide.body}</p>
          </div>
        </div>

        <div className="mt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {isLast ? (
            <Button
              type="button"
              onClick={finish}
              disabled={!cta}
              className="h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
            >
              {cta === "light-flare" ? (
                <>
                  <FlameIcon className="size-4" />
                  light your first flare
                </>
              ) : cta === "add-friend" ? (
                <>
                  <QrCodeIcon className="size-4" />
                  add your first friend
                </>
              ) : (
                "one moment…"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => goTo(index + 1)}
              className="h-12 w-full rounded-full bg-foreground text-sm text-background hover:bg-foreground/90"
            >
              next
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <style>{`
        .sponti-intro-slide { animation: sponti-intro-in 280ms cubic-bezier(0.32, 0.72, 0, 1); }
        @keyframes sponti-intro-in {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: none; }
        }
        .sponti-intro-ring { animation: sponti-intro-ring 2.4s ease-out infinite; }
        @keyframes sponti-intro-ring {
          from { transform: scale(0.6); opacity: 0.6; }
          to { transform: scale(1.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sponti-intro-slide { animation: none; }
          .sponti-intro-ring { animation: none; opacity: 0.25; }
        }
      `}</style>
    </div>
  )
}

// ---- Illustrations: app shapes only, no made-up people or counts ----

function MapGrid() {
  return (
    <div
      className="absolute inset-0 opacity-60"
      style={{
        backgroundImage:
          "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  )
}

function MapIllustration() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <MapGrid />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="sponti-intro-ring absolute inset-0 rounded-full border-2 border-accent" />
        <span className="relative flex size-12 items-center justify-center rounded-full bg-accent/20 text-accent-ink">
          <FlameIcon className="size-6" />
        </span>
      </div>
      <span className="absolute top-[22%] left-[20%] flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
        <FlameIcon className="size-4" />
      </span>
      <span className="absolute right-[18%] bottom-[22%] flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
        <FlameIcon className="size-4" />
      </span>
      <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-xl border-l-[3px] border-l-accent bg-background px-3 py-2 shadow-(--shadow-card)">
        <MapPinIcon className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">now · nearby</span>
      </div>
    </div>
  )
}

function Chip({
  children,
  selected = false,
}: {
  children: React.ReactNode
  selected?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
        selected
          ? "border-transparent bg-muted font-medium text-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </span>
  )
}

function ComposeIllustration() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <MapGrid />
      <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-(--shadow-card)">
        <span className="text-xs text-muted-foreground">light a flare</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip selected>
            <UsersIcon className="size-3" />
            hang out
          </Chip>
          <Chip>drinks</Chip>
          <Chip>food</Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip selected>
            <ClockIcon className="size-3" />
            now
          </Chip>
          <Chip>in 1h</Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip selected>
            <MapPinIcon className="size-3" />
            where you are
          </Chip>
        </div>
      </div>
    </div>
  )
}

function AudienceIllustration() {
  const rows = [
    { icon: UsersIcon, label: "all friends", selected: false },
    { icon: UserCheckIcon, label: "one circle", selected: true },
    { icon: GlobeIcon, label: "public", selected: false },
  ]
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <MapGrid />
      <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-background p-2 shadow-(--shadow-card)">
        {rows.map(({ icon: Icon, label, selected }) => (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              selected
                ? "bg-card font-semibold text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
