"use client"

// PROTOTYPE (#506), direction B, "pitch": nuraform-like. The app is the
// hero: a phone on the map with flare cards and pins floating around it at
// different depths, following the cursor. Then the problem (five apps to
// plan one beer, folding into one flare as you scroll), how it works as
// three cards that play when they scroll in, a feature grid with a hover
// spotlight, the motivation over art, and a closing call to action.

import {
  BellIcon,
  CalendarBlankIcon,
  ChatIcon,
  EnvelopeIcon,
  FlameIcon,
  ForkKnifeIcon,
  LockIcon,
  MapTrifoldIcon,
  MegaphoneIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { WHO_REPORT_URL } from "@/components/intro-slides"
import { cn } from "@/lib/utils"
import {
  ArtSlot,
  ComposeScreen,
  DesktopQr,
  JoinScreen,
  Logo,
  MapScreen,
  OpenSponti,
  Phone,
  RailCard,
  Reveal,
  TestingNote,
  spotlight,
  useInView,
  usePointerVar,
  useScrollVar,
} from "./_shared"

export function VariantB() {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 lg:px-8">
          <Logo />
          <OpenSponti className="h-9 px-4 text-xs shadow-none" />
        </div>
      </header>
      <Hero />
      <Problem />
      <How />
      <Features />
      <Why />
      <Closing />
      <footer className="border-t border-border/60 px-6 py-6">
        <LegalLinks />
      </footer>
    </div>
  )
}

/** A layer that moves with the cursor by `depth` px. */
function depth(px: number) {
  return {
    transform: `translate3d(calc(var(--mx, 0) * ${px}px), calc(var(--my, 0) * ${px}px), 0)`,
  }
}

function Hero() {
  const ref = usePointerVar<HTMLElement>()
  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden px-6 pt-14 pb-20 text-center lg:pt-24"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[70%] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--accent)_22%,transparent),transparent)]"
      />
      <Reveal>
        <TestingNote className="justify-center rounded-full border border-border/60 bg-card/60 px-3 py-1.5" />
      </Reveal>
      <Reveal delay={100}>
        <h1 className="mx-auto mt-6 max-w-3xl text-[2.6rem] leading-[1.03] font-medium tracking-tight text-balance lg:text-7xl">
          plans with friends, right now or soon
        </h1>
      </Reveal>
      <Reveal delay={200}>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground lg:text-lg">
          say what you&apos;re up to. the people you pick see it on their map,
          and tap join. no group chat needed.
        </p>
      </Reveal>
      <Reveal delay={300} className="mt-8 flex justify-center">
        <OpenSponti className="w-full max-w-xs lg:w-fit" />
      </Reveal>

      <div className="relative mx-auto mt-16 flex w-fit justify-center">
        <div
          style={depth(-6)}
          className="transition-transform duration-500 ease-out"
        >
          <Phone className="w-[16rem] lg:w-[18rem]">
            <MapScreen />
          </Phone>
        </div>
        <Floating
          className="top-[12%] -left-[9.5rem] hidden sm:block"
          px={22}
          delay="0s"
        >
          <RailCard
            title="flea market at mauerpark"
            meta="tomorrow 14:00 · 5 going"
            Icon={UsersIcon}
            open
            className="w-60 border-l-flare-open"
          />
        </Floating>
        <Floating
          className="top-[46%] -right-[10rem] hidden sm:block"
          px={30}
          delay="-2s"
        >
          <RailCard
            title="pho on kantstraße"
            meta="by jo · in 30 min"
            Icon={ForkKnifeIcon}
            className="w-56 border-l-flare-invite"
          />
        </Floating>
        <Floating
          className="bottom-[14%] -left-[6rem] hidden sm:block"
          px={16}
          delay="-4s"
        >
          <span className="flex items-center gap-2 rounded-full bg-card px-3 py-2 text-xs shadow-lg">
            <span className="size-1.5 rounded-full bg-accent" />
            sam joined your flare
          </span>
        </Floating>
      </div>
      <DesktopQr className="mx-auto mt-12 w-fit text-left" />
    </section>
  )
}

function Floating({
  children,
  className,
  px,
  delay,
}: {
  children: React.ReactNode
  className?: string
  px: number
  delay: string
}) {
  return (
    <div className={cn("absolute z-10", className)}>
      <div
        style={depth(px)}
        className="transition-transform duration-500 ease-out"
      >
        <div className="lp-float" style={{ animationDelay: delay }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const APPS: { Icon: Icon; label: string; x: number; y: number }[] = [
  { Icon: ChatIcon, label: "group chat", x: -150, y: -60 },
  { Icon: EnvelopeIcon, label: "email", x: 140, y: -80 },
  { Icon: CalendarBlankIcon, label: "calendar", x: -120, y: 80 },
  { Icon: MegaphoneIcon, label: "event page", x: 150, y: 60 },
  { Icon: BellIcon, label: "reminders", x: 0, y: -130 },
]

/** Five apps to plan one beer, folding into one flare as you scroll. */
function Problem() {
  const ref = useScrollVar<HTMLElement>()
  // 0 → scattered, 1 → gathered (over the middle of the scroll).
  const gather = "clamp(0, calc((var(--p, 0) - 0.3) * 3.3), 1)"
  return (
    <section
      ref={ref}
      className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2 lg:px-8 lg:py-36"
    >
      <Reveal>
        <p className="text-sm font-medium text-muted-foreground">the problem</p>
        <h2 className="mt-3 text-3xl leading-tight font-medium tracking-tight lg:text-5xl">
          five apps to plan one beer
        </h2>
        <p className="mt-5 max-w-md text-muted-foreground lg:text-lg">
          a poll in the group chat, a link in an email, an event nobody opens, a
          calendar invite at midnight. sponti is one place: say it, and
          whoever&apos;s free shows up.
        </p>
      </Reveal>
      <div className="relative mx-auto h-80 w-full max-w-sm">
        {APPS.map(({ Icon, label, x, y }) => (
          <span
            key={label}
            className="absolute top-1/2 left-1/2 flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground shadow"
            style={{
              transform: `translate(-50%, -50%) translate(calc(${x}px * (1 - ${gather})), calc(${y}px * (1 - ${gather}))) scale(calc(1 - ${gather} * 0.6))`,
              opacity: `calc(1 - ${gather})`,
            }}
          >
            <Icon className="size-4" />
            {label}
          </span>
        ))}
        <span
          className="absolute top-1/2 left-1/2 flex size-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_60px_-10px_var(--accent)]"
          style={{
            transform: `translate(-50%, -50%) scale(calc(0.3 + ${gather} * 0.7))`,
            opacity: gather,
          }}
        >
          <FlameIcon className="size-9" />
        </span>
      </div>
    </section>
  )
}

const HOW = [
  {
    n: "01",
    title: "say what you're up to",
    body: "right now, or at a time you pick.",
    Screen: ComposeScreen,
  },
  {
    n: "02",
    title: "your people see it",
    body: "on their map, not in a muted chat.",
    Screen: MapScreen,
  },
  {
    n: "03",
    title: "they tap join",
    body: "and you see who's coming.",
    Screen: JoinScreen,
  },
]

function How() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 lg:px-8">
      <Reveal className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          how it works
        </p>
        <h2 className="mt-3 text-3xl leading-tight font-medium tracking-tight lg:text-5xl">
          three taps, no group chat
        </h2>
      </Reveal>
      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {HOW.map((step, i) => (
          <HowCard key={step.n} index={i} {...step} />
        ))}
      </div>
    </section>
  )
}

function HowCard({
  index,
  n,
  title,
  body,
  Screen,
}: {
  index: number
  n: string
  title: string
  body: string
  Screen: (props: { play?: boolean }) => React.ReactNode
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.45)
  return (
    <Reveal delay={index * 120}>
      <div
        ref={ref}
        onPointerMove={spotlight}
        className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-border/60 bg-card/50 p-6 transition-transform duration-300 hover:-translate-y-1"
      >
        <SpotlightGlow />
        <span className="text-sm text-muted-foreground tabular-nums">{n}</span>
        <p className="mt-1 text-lg font-semibold">{title}</p>
        <p className="text-muted-foreground">{body}</p>
        <div className="mt-6 flex h-[22rem] justify-center overflow-hidden">
          <Phone className="w-[13rem] translate-y-4 transition-transform duration-500 group-hover:translate-y-0">
            <Screen play={inView} />
          </Phone>
        </div>
      </div>
    </Reveal>
  )
}

function SpotlightGlow() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{
        background:
          "radial-gradient(240px circle at var(--sx, 50%) var(--sy, 0%), color-mix(in oklch, var(--accent) 14%, transparent), transparent 70%)",
      }}
    />
  )
}

const FEATURES: { Icon: Icon; title: string; body: string }[] = [
  {
    Icon: MapTrifoldIcon,
    title: "now on the map",
    body: "what's happening right now, near you.",
  },
  {
    Icon: CalendarBlankIcon,
    title: "later in the calendar",
    body: "flares with a picked time wait there.",
  },
  {
    Icon: LockIcon,
    title: "you pick who sees it",
    body: "close friends, a circle, or anyone nearby.",
  },
  {
    Icon: BellIcon,
    title: "quiet by default",
    body: "no read receipts, quiet hours built in.",
  },
]

function Features() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
      {FEATURES.map(({ Icon, title, body }, i) => (
        <Reveal key={title} delay={i * 80}>
          <div
            onPointerMove={spotlight}
            className="group relative h-full overflow-hidden rounded-3xl border border-border/60 bg-card/50 p-5 transition-transform duration-300 hover:-translate-y-1"
          >
            <SpotlightGlow />
            <Icon className="size-6 text-accent-ink transition-transform duration-300 group-hover:scale-110" />
            <p className="mt-4 font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        </Reveal>
      ))}
    </section>
  )
}

function Why() {
  const ref = useScrollVar<HTMLElement>()
  return (
    <section
      ref={ref}
      className="relative isolate mx-4 overflow-hidden rounded-[2.5rem] border border-border/60 lg:mx-auto lg:w-full lg:max-w-6xl"
    >
      <ArtSlot
        name="why"
        className="absolute inset-0 -z-10 [transform:translateY(calc((var(--p,0.5)-0.5)*-80px))_scale(1.15)]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/80 to-background/10" />
      <Reveal className="max-w-xl px-8 py-20 lg:px-14 lg:py-28">
        <p className="text-sm font-medium text-muted-foreground">
          why it exists
        </p>
        <h2 className="mt-3 text-3xl leading-tight font-medium tracking-tight lg:text-5xl">
          we&apos;re more connected than ever, and more alone
        </h2>
        <p className="mt-5 text-muted-foreground lg:text-lg">
          messages everywhere, and still no time to catch up with your best
          friends. sponti is built to get you off your phone and out with them.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          source:{" "}
          <a
            href={WHO_REPORT_URL}
            className="underline underline-offset-2 hover:text-foreground"
          >
            who commission on social connection (2025)
          </a>
        </p>
      </Reveal>
    </section>
  )
}

function Closing() {
  return (
    <section className="px-6 py-28 text-center lg:py-36">
      <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-6">
        <h2 className="text-4xl leading-tight font-medium tracking-tight text-balance lg:text-6xl">
          see who&apos;s up for something
        </h2>
        <OpenSponti className="w-full max-w-xs lg:w-fit" />
        <TestingNote className="justify-center" />
        <DesktopQr className="mt-2 text-left" />
      </Reveal>
    </section>
  )
}
