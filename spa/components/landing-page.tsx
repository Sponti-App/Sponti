"use client"

import { createContext, useContext } from "react"
import {
  ArrowRightIcon,
  BellIcon,
  CalendarBlankIcon,
  ChatIcon,
  EnvelopeIcon,
  FlameIcon,
  LockIcon,
  MapTrifoldIcon,
  MegaphoneIcon,
  type Icon,
} from "@/components/icons"
import { WHO_REPORT_URL } from "@/components/intro-slides"
import { LegalLinks } from "@/components/legal-links"
import { PhoneQr } from "@/components/phone-qr"
import { LandingStyles } from "@/components/landing/landing-styles"
import {
  Reveal,
  Typewriter,
  depth,
  spotlight,
  useInView,
  usePointerVar,
  useScrollVar,
  useScrolledPast,
} from "@/components/landing/motion"
import {
  ComposeScreen,
  JoinScreen,
  MapScreen,
  Phone,
} from "@/components/landing/previews"
import { Scene } from "@/components/landing/scene"
import { LANDING_SCENES } from "@/lib/landing-art"
import { cn } from "@/lib/utils"

// #506: the sponti.fun landing page, a pitch told in the brand exploration's
// world (2026-10-07): cream, indigo and one coral flare, condensed display
// type, and illustrated scenes before app screens. Static, public, and outside
// the app: no session check, no api, no nav, no mobile gate (app-chrome.tsx).
//
// Top to bottom: the rooftop scene with the headline over it; the problem
// (five apps folding into one flare); how it works, with the app's phones on
// the one indigo band; what's happening now (the park scene, with flares on
// its lights); the deck's short lines; the app's dark mode, quietly; why it
// exists; and "light a flare" over the crowd. Every "open sponti" goes to the
// app, a QR code of it sits beside the calls to action on desktop, and an
// honest testing note sits near them and in the footer.
//
// Images come from lib/landing-art.ts. Motion is in components/landing/
// motion.tsx; reduced motion gets every final state.

const AppUrl = createContext("/")

export function LandingPage({ appUrl }: { appUrl: string }) {
  return (
    <AppUrl.Provider value={appUrl}>
      <div data-landing className="relative flex min-h-dvh flex-col">
        <LandingStyles />
        <header className="sticky top-0 z-30 h-15 border-b border-border/40 bg-background/30 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-6 lg:px-8">
            <Logo />
            <OpenSponti className="h-9 px-4 text-xs shadow-none" />
          </div>
        </header>
        <main className="flex flex-col">
          <Hero />
          <Problem />
          <How />
          <Now />
          <Lines />
          <Night />
          <Why />
          <Closing />
        </main>
        <footer className="flex flex-col items-center gap-3 border-t border-border/60 px-6 py-6">
          <TestingNote className="justify-center" />
          <LegalLinks />
        </footer>
      </div>
    </AppUrl.Provider>
  )
}

// ---- small parts ----------------------------------------------------------------

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-accent/20 text-accent-ink">
        <FlameIcon className="size-3.5" />
      </span>
      <span className="text-sm font-semibold">sponti</span>
    </span>
  )
}

/** "open sponti". Coral by default; `ink` (indigo, cream text) for the
 * hero's, where it sits over the warm scene. */
function OpenSponti({
  className,
  ink = false,
}: {
  className?: string
  ink?: boolean
}) {
  const appUrl = useContext(AppUrl)
  return (
    <a
      href={appUrl}
      data-landing-cta
      className={cn(
        "group inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 text-sm font-medium transition-[transform,background-color,box-shadow] outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        ink
          ? "bg-foreground text-background shadow-[0_10px_30px_-10px_var(--foreground)] hover:bg-foreground/90 hover:shadow-[0_16px_40px_-12px_var(--foreground)]"
          : "bg-accent text-accent-foreground shadow-[0_8px_30px_-8px_var(--accent)] hover:bg-accent/90 hover:shadow-[0_14px_40px_-10px_var(--accent)]",
        className
      )}
    >
      open sponti
      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}

/** The mobile gate's rule for a desktop: hover, a fine pointer, a wide
 * screen. Sponti is made for the phone, so a desktop gets a QR code too. */
const DESKTOP_ONLY =
  "hidden [@media(hover:hover)_and_(pointer:fine)_and_(min-width:900px)]:flex"

function DesktopQr({ className }: { className?: string }) {
  const appUrl = useContext(AppUrl)
  return (
    <div
      data-landing-qr
      className={cn(DESKTOP_ONLY, "items-center gap-4", className)}
    >
      <PhoneQr
        url={appUrl}
        alt="qr code to open sponti"
        className="size-24 shrink-0 rounded-xl p-1.5"
      />
      <div className="flex flex-col gap-1 text-left">
        <p className="text-sm font-semibold">made for your phone</p>
        <p className="text-sm text-muted-foreground">
          scan this to open sponti there.
        </p>
      </div>
    </div>
  )
}

/** The honest note: early testing, things may break. */
function TestingNote({ className }: { className?: string }) {
  return (
    <p
      data-testing-note
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-flare-open"
      />
      <span>early testing in berlin. things may break.</span>
    </p>
  )
}

function FloatCard({
  children,
  className,
  px,
  delay,
  reveal,
}: {
  children: React.ReactNode
  className?: string
  px: number
  delay: string
  reveal: number
}) {
  return (
    <div aria-hidden="true" className={cn("absolute", className)}>
      <Reveal delay={reveal}>
        <div
          style={{ transform: depth(px) }}
          className="transition-transform duration-500 ease-out"
        >
          <div
            className="lp-float flex items-center gap-3 rounded-2xl bg-card/85 px-3 py-2.5 shadow-[0_20px_50px_-20px_rgb(46_32_95/0.45)] backdrop-blur-md"
            style={{ animationDelay: delay }}
          >
            {children}
          </div>
        </div>
      </Reveal>
    </div>
  )
}

// ---- sections -------------------------------------------------------------------

/** The rooftop scene fills the hero, behind the header too, drifting a
 * little with the cursor. The words sit on a soft cream glow over its sky. */
function Hero() {
  const ref = usePointerVar<HTMLElement>()
  return (
    <section
      ref={ref}
      aria-labelledby="landing-title"
      className="relative isolate -mt-15 flex min-h-[100svh] flex-col overflow-hidden px-6 pt-24 pb-8 text-center lg:pt-28"
    >
      <Scene
        name="rooftop"
        priority
        className="absolute inset-0 -z-20"
        move={`translate(-50%, -50%) ${depth(-12)} scale(1.05)`}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[75%] bg-[radial-gradient(70%_80%_at_50%_10%,color-mix(in_oklch,var(--background)_88%,transparent),color-mix(in_oklch,var(--background)_55%,transparent)_45%,transparent_75%)] lg:bg-[radial-gradient(45%_75%_at_50%_15%,color-mix(in_oklch,var(--background)_85%,transparent),color-mix(in_oklch,var(--background)_45%,transparent)_50%,transparent_78%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-background to-transparent"
      />
      <Reveal>
        <TestingNote className="justify-center rounded-full bg-background/75 px-3 py-1.5 backdrop-blur-sm" />
      </Reveal>
      <Reveal delay={100}>
        <h1
          id="landing-title"
          className="lp-display mx-auto mt-6 max-w-5xl text-[3.6rem] text-balance lg:text-[8rem]"
        >
          turn &ldquo;we should&rdquo; into{" "}
          <span className="lp-coral">&ldquo;we&apos;re here.&rdquo;</span>
        </h1>
      </Reveal>
      <Reveal delay={200}>
        <p className="mx-auto mt-5 max-w-lg text-base font-medium lg:text-lg">
          sponti is for plans with friends, right now or soon. light a flare,
          and whoever&apos;s free comes along. no group chat needed.
        </p>
      </Reveal>
      <Reveal delay={300} className="mt-8 flex justify-center">
        <OpenSponti ink className="w-full max-w-xs lg:w-fit" />
      </Reveal>

      {/* Two small app moments, floating over the scene. */}
      <div className="pointer-events-none relative mx-auto mt-auto h-32 w-full max-w-5xl lg:h-40">
        <FloatCard
          className="bottom-2 left-0 lg:left-[4%]"
          px={22}
          delay="0s"
          reveal={600}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <FlameIcon weight="fill" className="size-4" />
          </span>
          <span className="text-left">
            <span className="block text-sm font-semibold">mia lit a flare</span>
            <span className="block text-xs text-muted-foreground">
              drinks on the roof · live
            </span>
          </span>
        </FloatCard>
        <FloatCard
          className="right-[6%] bottom-16 hidden sm:block"
          px={32}
          delay="-3s"
          reveal={900}
        >
          <span className="size-2 rounded-full bg-accent" />
          <span className="text-sm">sam and 4 others joined</span>
        </FloatCard>
      </div>
      <DesktopQr className="mx-auto mt-6 w-fit rounded-2xl bg-background/80 p-3 pr-5 backdrop-blur-sm" />
    </section>
  )
}

const APPS: { Icon: Icon; label: string; x: number; y: number }[] = [
  { Icon: ChatIcon, label: "group chat", x: -150, y: -60 },
  { Icon: EnvelopeIcon, label: "email", x: 140, y: -80 },
  { Icon: CalendarBlankIcon, label: "calendar", x: -120, y: 80 },
  { Icon: MegaphoneIcon, label: "event page", x: 150, y: 60 },
  { Icon: BellIcon, label: "reminders", x: 0, y: -130 },
]

const PLANS = [
  "beer",
  "dinner",
  "picnic",
  "gig",
  "bike ride",
  "game night",
  "sauna day",
  "flea market run",
]

/** Five apps to plan one ___, folding into one soft flare as you scroll. */
function Problem() {
  // Reduced motion rests past the fold, so the flare shows lit.
  const ref = useScrollVar<HTMLElement>(0.8)
  const lit = useScrolledPast(ref, 0.6)
  // 0 → scattered, 1 → gathered (over the middle of the scroll).
  const gather = "clamp(0, calc((var(--p, 0) - 0.3) * 3.3), 1)"
  return (
    <section
      ref={ref}
      aria-labelledby="landing-problem"
      className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2 lg:px-8 lg:py-36"
    >
      <Reveal>
        <p className="lp-eyebrow">digital overdose, social famine.</p>
        <h2
          id="landing-problem"
          className="lp-display mt-4 text-5xl lg:text-7xl"
        >
          five apps to plan one{" "}
          <Typewriter words={PLANS} className="lp-coral" />
        </h2>
        <p className="mt-6 max-w-md text-muted-foreground lg:text-lg">
          a poll in the group chat, a link in an email, an event nobody opens, a
          calendar invite at midnight.{" "}
          <span className="font-semibold text-foreground">
            a group chat is where plans go to die.
          </span>
        </p>
      </Reveal>
      <div aria-hidden="true" className="relative mx-auto h-80 w-full max-w-sm">
        {APPS.map(({ Icon, label, x, y }) => (
          <span
            key={label}
            className="absolute top-1/2 left-1/2 flex items-center gap-2 rounded-2xl bg-card px-3 py-2 text-sm text-muted-foreground shadow-[0_10px_30px_-12px_rgb(46_32_95/0.35)]"
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
          data-lit={lit}
          className="lp-orb absolute top-1/2 left-1/2 flex size-36 items-center justify-center rounded-full lg:size-40"
          style={{
            transform: `translate(-50%, -50%) scale(calc(0.25 + ${gather} * 0.75))`,
            opacity: gather,
          }}
        >
          <span className="lp-orb-ring" />
          <span className="lp-orb-ring" style={{ animationDelay: "0.4s" }} />
          <FlameIcon
            weight="fill"
            className="lp-orb-icon size-12 text-foreground/85 lg:size-14"
          />
        </span>
      </div>
    </section>
  )
}

const HOW = [
  {
    title: "say what you're up to",
    body: "right now, or at a time you pick.",
    Screen: ComposeScreen,
  },
  {
    title: "your people see it",
    body: "on their map, not in a muted chat.",
    Screen: MapScreen,
  },
  {
    title: "they tap join",
    body: "and you see who's coming.",
    Screen: JoinScreen,
  },
]

/** The page's one dark band: indigo, the app's phones, a coral glow. */
function How() {
  return (
    <section
      aria-labelledby="landing-how"
      className="lp-indigo relative isolate mx-3 overflow-hidden rounded-[2.5rem] px-6 py-20 lg:mx-auto lg:w-[calc(100%-3rem)] lg:max-w-7xl lg:px-10 lg:py-28"
    >
      <span
        aria-hidden="true"
        className="absolute -top-40 -right-32 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(255_152_107/0.55),rgb(183_167_216/0.18)_45%,transparent_70%)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-48 -left-40 -z-10 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(183_167_216/0.3),transparent_65%)]"
      />
      <Reveal className="text-center">
        <p className="lp-eyebrow">how it works</p>
        <h2 id="landing-how" className="lp-display mt-4 text-5xl lg:text-8xl">
          one tap. <span className="lp-coral">broadcast</span> or join.
        </h2>
      </Reveal>
      <ol className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-3">
        {HOW.map((step, i) => (
          <HowStep key={step.title} index={i} {...step} />
        ))}
      </ol>
    </section>
  )
}

function HowStep({
  index,
  title,
  body,
  Screen,
}: {
  index: number
  title: string
  body: string
  Screen: (props: { play?: boolean }) => React.ReactNode
}) {
  const [ref, inView] = useInView<HTMLLIElement>(0.45)
  return (
    <li ref={ref} data-landing-step>
      <Reveal delay={index * 120} className="h-full">
        <div
          onPointerMove={spotlight}
          className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-white/[0.06] p-6 ring-1 ring-white/10 transition-transform duration-300 hover:-translate-y-1"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(260px circle at var(--sx, 50%) var(--sy, 0%), rgb(255 152 107 / 0.22), transparent 70%)",
            }}
          />
          <span
            aria-hidden="true"
            className="lp-display text-3xl text-(--coral)"
          >
            0{index + 1}
          </span>
          <p className="mt-2 text-lg font-semibold">{title}</p>
          <p className="text-muted-foreground">{body}</p>
          <div aria-hidden="true" className="mt-6 flex justify-center">
            <Phone className="w-[13rem] border-white/10 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] transition-transform duration-500 group-hover:-translate-y-1">
              <Screen play={inView} />
            </Phone>
          </div>
        </div>
      </Reveal>
    </li>
  )
}

/** The park scene, with flares popping where it glows. Where the frame is
 * narrower than the scene (phones), it pans across as you scroll. */
const NOW_CHIPS = [
  { glow: 0, label: "drinks on the terrace", meta: "live · 5 going" },
  { glow: 1, label: "ping pong", meta: "open to all · 2 going" },
  { glow: 2, label: "picnic on the hill", meta: "in 20 min" },
]

function Now() {
  const ref = useScrollVar<HTMLElement>()
  const [frame, inView] = useInView<HTMLDivElement>(0.4)
  const glow = LANDING_SCENES.park.glow
  // 0 shows the scene's left edge, 1 its right.
  const pan = "clamp(0, calc((var(--p, 0) - 0.25) * 2), 1)"
  return (
    <section ref={ref} aria-labelledby="landing-now" className="py-24 lg:py-36">
      <Reveal className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <p className="lp-eyebrow">map = now.</p>
        <h2
          id="landing-now"
          className="lp-display mt-4 max-w-3xl text-5xl lg:text-8xl"
        >
          what&apos;s happening <span className="lp-coral">now.</span>
        </h2>
        <p className="mt-5 max-w-md text-muted-foreground lg:text-lg">
          every flare is a little light on your friends&apos; map. open the app
          and see who&apos;s out, and where.
        </p>
      </Reveal>
      <div ref={frame} className="mx-3 mt-12 lg:mx-auto lg:max-w-7xl">
        <Scene
          name="park"
          sizes="(min-width: 1024px) 80rem, 200vw"
          className="h-[70svh] max-h-[44rem] min-h-[26rem] rounded-[2.5rem]"
          move={`translate(calc(-50% + (100% - 100cqw) / 2 * (1 - 2 * ${pan})), -50%)`}
        >
          {NOW_CHIPS.map((chip, i) => {
            const g = glow[chip.glow]
            return (
              <span
                key={chip.label}
                aria-hidden="true"
                className={cn(
                  "absolute flex -translate-x-1/2 items-center gap-2 rounded-full bg-card/90 py-1.5 pr-3 pl-1.5 text-xs whitespace-nowrap shadow-[0_14px_30px_-12px_rgb(46_32_95/0.5)] backdrop-blur-md transition-[opacity,translate] duration-700 ease-out",
                  inView ? "opacity-100" : "translate-y-3 opacity-0"
                )}
                style={{
                  left: `${g.x}%`,
                  top: `calc(${g.y}% - 3.25rem)`,
                  transitionDelay: inView ? `${300 + i * 350}ms` : "0ms",
                }}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <FlameIcon weight="fill" className="size-3" />
                </span>
                <span className="font-semibold">{chip.label}</span>
                <span className="text-muted-foreground">{chip.meta}</span>
              </span>
            )
          })}
        </Scene>
      </div>
    </section>
  )
}

/** The rest of the app, as the deck's short statements. */
const LINES: { Icon: Icon; line: React.ReactNode; body: string }[] = [
  {
    Icon: MapTrifoldIcon,
    line: (
      <>
        map <span className="lp-coral">=</span> now.
      </>
    ),
    body: "what's happening right now, near you.",
  },
  {
    Icon: CalendarBlankIcon,
    line: (
      <>
        calendar <span className="lp-coral">=</span> upcoming.
      </>
    ),
    body: "flares with a picked time wait there.",
  },
  {
    Icon: LockIcon,
    line: "your people, grouped your way.",
    body: "close friends, a circle, or anyone nearby. you pick who sees it.",
  },
  {
    Icon: BellIcon,
    line: "quiet by default.",
    body: "no read receipts, no pings at 2am. quiet hours are built in.",
  },
]

function Lines() {
  return (
    <section
      aria-label="what's in the app"
      className="mx-auto grid w-full max-w-6xl gap-x-12 gap-y-14 px-6 pb-24 sm:grid-cols-2 lg:px-8 lg:pb-36"
    >
      {LINES.map(({ Icon, line, body }, i) => (
        <Reveal key={body} delay={(i % 2) * 120}>
          <div className="group border-t border-border pt-6">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-foreground">
              <Icon className="size-5" />
            </span>
            <h3 className="lp-display mt-5 text-4xl lg:text-5xl">{line}</h3>
            <p className="mt-3 max-w-sm text-muted-foreground">{body}</p>
          </div>
        </Reveal>
      ))}
    </section>
  )
}

/**
 * The app's dark mode, without making a thing of it: one phone whose map
 * turns from light to dark as you scroll past, like the sun going down in
 * the scenes. Reduced motion rests halfway, showing both.
 */
function Night() {
  // Fully dark by the time the phone reaches the middle of the screen.
  // Reduced motion rests at the halfway point (0.25 + 0.5 / 3.5 ≈ 0.39).
  const ref = useScrollVar<HTMLElement>(0.39)
  const [phone, inView] = useInView<HTMLDivElement>(0.3)
  const dusk = "clamp(0, calc((var(--p, 0) - 0.25) * 3.5), 1)"
  return (
    <section
      ref={ref}
      aria-labelledby="landing-night"
      className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 pb-24 lg:grid-cols-[1fr_auto] lg:gap-20 lg:px-8 lg:pb-36"
    >
      <Reveal>
        <p className="lp-eyebrow">light or dark</p>
        <h2 id="landing-night" className="lp-display mt-4 text-4xl lg:text-6xl">
          easy on the eyes after <span className="lp-coral">sunset.</span>
        </h2>
        <p className="mt-5 max-w-sm text-muted-foreground lg:text-lg">
          sponti follows your phone&apos;s light or dark setting, so a late plan
          doesn&apos;t light up the whole bar.
        </p>
      </Reveal>
      <div ref={phone} aria-hidden="true" className="flex justify-center">
        <Phone className="w-[14rem]">
          <MapScreen play={inView} />
          <div
            data-landing-dark
            className="lp-app-dark absolute inset-0 z-[15]"
            style={{ clipPath: `inset(0 0 calc((1 - ${dusk}) * 100%) 0)` }}
          >
            <MapScreen play={inView} />
          </div>
        </Phone>
      </div>
    </section>
  )
}

function Why() {
  const ref = useScrollVar<HTMLElement>()
  return (
    <section
      ref={ref}
      aria-labelledby="landing-why"
      className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-24 lg:grid-cols-[1fr_26rem] lg:px-8 lg:pb-36"
    >
      <Reveal>
        <p className="lp-eyebrow">why it exists</p>
        <h2 id="landing-why" className="lp-display mt-4 text-5xl lg:text-7xl">
          more connected than ever, and more alone.
        </h2>
        <p className="mt-6 max-w-md text-muted-foreground lg:text-lg">
          messages everywhere, and still no time to catch up with your best
          friends. sponti is built to get you off your phone and out with them.
        </p>
        <p className="lp-display mt-8 text-3xl lg:text-4xl">
          make it easier to be <span className="lp-coral">together.</span>
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
      <Scene
        name="walk"
        sizes="(min-width: 1024px) 26rem, 100vw"
        className="aspect-[4/5] w-full rounded-[2.5rem]"
        move="translate(-50%, calc(-50% + (var(--p, 0.5) - 0.5) * -70px)) scale(1.12)"
      />
    </section>
  )
}

function Closing() {
  const ref = useScrollVar<HTMLElement>()
  return (
    <section
      ref={ref}
      aria-labelledby="landing-close"
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden px-6 pt-40 pb-16 text-center lg:pb-24"
    >
      <Scene
        name="crowd"
        className="absolute inset-0 -z-20"
        move="translate(-50%, calc(-50% + (var(--p, 0.5) - 0.5) * -90px)) scale(1.1)"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-background to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[60%] bg-gradient-to-t from-background via-background/85 to-transparent"
      />
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-6">
        <h2
          id="landing-close"
          className="lp-display text-7xl text-balance lg:text-[9rem]"
        >
          light a <span className="lp-coral">flare.</span>
        </h2>
        <p className="max-w-md text-base lg:text-lg">
          see who&apos;s up for something, right now or soon.
        </p>
        <OpenSponti className="w-full max-w-xs lg:w-fit" />
        <DesktopQr className="mt-2" />
      </Reveal>
    </section>
  )
}
