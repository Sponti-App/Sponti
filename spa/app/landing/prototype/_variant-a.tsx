"use client"

// PROTOTYPE (#506), direction A, "quiet story": interlude-like calm. Big
// type and space, art that drifts with the scroll and tilts with the cursor,
// the motivation read word by word, and one pinned "how it works" where the
// phone steps through the core loop as you scroll (desktop). On a phone the
// steps stack, each with its own phone that plays when it scrolls in.

import Link from "next/link"
import { BellIcon, CalendarBlankIcon, UsersIcon } from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { WHO_REPORT_URL } from "@/components/intro-slides"
import { cn } from "@/lib/utils"
import {
  ArtSlot,
  DesktopQr,
  LoopScreens,
  Logo,
  OpenSponti,
  Phone,
  Reveal,
  TestingNote,
  useInView,
  usePointerVar,
  useScrollVar,
  useStickyStep,
  type Screen,
} from "./_shared"

const STEPS: { screen: Screen; title: string; body: string }[] = [
  {
    screen: "compose",
    title: "say what you're up to",
    body: "drinks, a walk, the flea market. right now, or at a time you pick.",
  },
  {
    screen: "map",
    title: "the people you pick see it",
    body: "it shows up on their map, not in a group chat they've muted.",
  },
  {
    screen: "join",
    title: "they tap join and come along",
    body: "you see who's coming. no polls, no back and forth.",
  },
]

const WHY =
  "messages everywhere, and still no time to catch up with your best friends. step back from the feed, and you miss the thing you wanted to go to."

export function VariantA() {
  return (
    <div className="flex flex-col">
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-4 lg:px-8 lg:pt-6">
        <Logo />
        <Link
          href="/"
          className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          open sponti
        </Link>
      </header>
      <Hero />
      <Why />
      <How />
      <Features />
      <Closing />
      <footer className="border-t border-border/60 px-6 py-6">
        <LegalLinks />
      </footer>
    </div>
  )
}

function Hero() {
  const pointer = usePointerVar<HTMLElement>()
  const scroll = useScrollVar<HTMLDivElement>()
  return (
    <section
      ref={pointer}
      className="relative isolate flex min-h-dvh flex-col overflow-hidden lg:grid lg:grid-cols-[1.25fr_1fr] lg:items-center"
    >
      <div
        ref={scroll}
        className="absolute inset-0 -z-10 overflow-hidden lg:relative lg:inset-auto lg:order-2 lg:h-dvh"
      >
        <ArtSlot
          name="hero"
          className="h-full w-full [transform:translate3d(calc(var(--mx,0)*-14px),calc(var(--p,0)*80px+var(--my,0)*-10px),0)_scale(1.08)] transition-transform duration-300 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent lg:bg-gradient-to-r lg:from-background lg:via-transparent" />
      </div>
      <div className="mt-auto px-6 pt-[52dvh] pb-14 lg:mt-0 lg:max-w-2xl lg:pt-0 lg:pr-8 lg:pb-0 lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]">
        <Reveal>
          <h1 className="text-[2.75rem] leading-[1.02] font-medium tracking-tight text-balance lg:text-[4.25rem]">
            plans with friends, right now or soon
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-5 max-w-md text-base text-muted-foreground lg:text-lg">
            too many chats, too many apps, and still nothing planned? light a
            flare, and see who comes.
          </p>
        </Reveal>
        <Reveal delay={240} className="mt-8 flex flex-col gap-5">
          <OpenSponti className="w-full lg:w-fit" />
          <TestingNote />
          <DesktopQr className="mt-2" />
        </Reveal>
      </div>
    </section>
  )
}

/** The motivation, lit word by word as it scrolls through the screen. */
function Why() {
  const ref = useScrollVar<HTMLElement>()
  const words = WHY.split(" ")
  return (
    <section
      ref={ref}
      className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-28 lg:grid-cols-[1fr_22rem] lg:items-center lg:px-8 lg:py-40"
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          why it exists
        </p>
        <h2 className="mt-3 text-3xl leading-tight font-medium tracking-tight lg:text-5xl">
          we&apos;re more connected than ever, and more alone
        </h2>
        <p className="mt-8 text-xl leading-relaxed lg:text-2xl">
          {words.map((word, i) => (
            <span
              key={i}
              className="transition-opacity duration-200"
              style={{
                // Each word lights up across the middle third of the scroll.
                opacity: `clamp(0.18, calc((var(--p, 0) - 0.25) * ${(words.length / 0.35).toFixed(1)} - ${i} + 1), 1)`,
              }}
            >
              {word}{" "}
            </span>
          ))}
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
      </div>
      <ArtSlot
        name="why"
        className="aspect-[4/5] w-full [transform:translateY(calc((var(--p,0.5)-0.5)*-60px))] rounded-[2rem] border border-border/60"
      />
    </section>
  )
}

function How() {
  const [ref, step] = useStickyStep<HTMLElement>(STEPS.length)
  return (
    <>
      {/* Desktop: pinned, the phone steps through the loop as you scroll. */}
      <section
        ref={ref}
        aria-labelledby="how-heading"
        className="relative hidden h-[300vh] lg:block"
      >
        <div className="sticky top-0 mx-auto grid h-dvh w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-20 px-8">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              how it works
            </p>
            <h2
              id="how-heading"
              className="mt-3 text-5xl leading-tight font-medium tracking-tight"
            >
              light a flare
            </h2>
            <ol className="mt-12 flex flex-col gap-8">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className={cn(
                    "flex gap-5 border-l-2 pl-5 transition-[opacity,border-color] duration-500",
                    i === step
                      ? "border-l-accent opacity-100"
                      : "border-l-border opacity-35"
                  )}
                >
                  <span className="text-sm text-muted-foreground tabular-nums">
                    0{i + 1}
                  </span>
                  <div>
                    <p className="text-xl font-semibold">{s.title}</p>
                    <p className="mt-1 max-w-sm text-muted-foreground">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <Phone>
            <LoopScreens screen={STEPS[step].screen} />
          </Phone>
        </div>
      </section>

      {/* Phone: the steps stack, each phone plays as it scrolls in. */}
      <section className="flex flex-col gap-20 px-6 py-24 lg:hidden">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            how it works
          </p>
          <h2 className="mt-2 text-3xl leading-tight font-medium tracking-tight">
            light a flare
          </h2>
        </div>
        {STEPS.map((s, i) => (
          <StackedStep key={s.title} index={i} {...s} />
        ))}
      </section>
    </>
  )
}

function StackedStep({
  index,
  screen,
  title,
  body,
}: {
  index: number
  screen: Screen
  title: string
  body: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5)
  return (
    <div ref={ref} className="flex flex-col items-center gap-6">
      <div className="self-start">
        <span className="text-sm text-muted-foreground tabular-nums">
          0{index + 1}
        </span>
        <p className="mt-1 text-xl font-semibold">{title}</p>
        <p className="mt-1 text-muted-foreground">{body}</p>
      </div>
      <Phone className="w-[15rem]">
        <LoopScreens screen={screen} play={inView} />
      </Phone>
    </div>
  )
}

const FEATURES = [
  {
    Icon: CalendarBlankIcon,
    title: "now on the map, later in the calendar",
    body: "one flare, two views. what's on right now, and what's coming up.",
  },
  {
    Icon: UsersIcon,
    title: "you pick who sees it",
    body: "close friends, a circle, or anyone nearby. invite only is plum, open to all is teal.",
  },
  {
    Icon: BellIcon,
    title: "quiet by default",
    body: "no group chat, no read receipts, no pings at 2am. quiet hours are built in.",
  },
]

function Features() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-24 lg:grid-cols-3 lg:px-8 lg:py-32">
      {FEATURES.map(({ Icon, title, body }, i) => (
        <Reveal key={title} delay={i * 120}>
          <span className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
            <Icon className="size-5" />
          </span>
          <p className="mt-4 text-lg font-semibold">{title}</p>
          <p className="mt-1 text-muted-foreground">{body}</p>
        </Reveal>
      ))}
    </section>
  )
}

function Closing() {
  const pointer = usePointerVar<HTMLElement>()
  return (
    <section
      ref={pointer}
      className="relative isolate overflow-hidden px-6 py-32 text-center lg:py-44"
    >
      <ArtSlot
        name="together"
        className="absolute inset-0 -z-10 [transform:translate3d(calc(var(--mx,0)*10px),calc(var(--my,0)*8px),0)_scale(1.05)] opacity-60 transition-transform duration-300"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background/40 to-background" />
      <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-6">
        <h2 className="text-4xl leading-tight font-medium tracking-tight text-balance lg:text-6xl">
          see who&apos;s up for something
        </h2>
        <OpenSponti className="w-full lg:w-fit" />
        <TestingNote className="justify-center" />
        <DesktopQr className="mt-2" />
      </Reveal>
    </section>
  )
}
