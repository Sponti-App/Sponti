"use client"

import type { ReactNode } from "react"
import {
  ArrowRightIcon,
  FlameIcon,
  MapPinIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons"
import {
  Backdrop,
  INTRO_COPY,
  IntroStyles,
  Source,
  type Kind,
} from "@/components/intro-slides"
import { LegalLinks } from "@/components/legal-links"
import { PhoneQr } from "@/components/phone-qr"
import { cn } from "@/lib/utils"

// #467 part 1: the sponti.fun landing page. Static, public, and outside the
// app: no session check, no api, no nav, no mobile gate (see app-chrome.tsx).
// It reuses the intro slides' copy and art (#377): what sponti is (with the
// one call to action), why it exists, and how it works. On a phone each part
// is a full screen of art with the words under it, like a slide; on a wide
// screen the art sits in a phone-shaped panel beside the words.
//
// "open sponti" is the only peach on the page. On a desktop (the mobile
// gate's rule: hover, a fine pointer and a wide screen) a QR code of the app
// sits under it, since sponti is made for the phone.

const DESKTOP =
  "hidden [@media(hover:hover)_and_(pointer:fine)_and_(min-width:900px)]:flex"

const STEPS: { Icon: Icon; title: string; body: string }[] = [
  {
    Icon: FlameIcon,
    title: "light a flare",
    body: "say what you're up to, right now or at a time you pick.",
  },
  {
    Icon: MapPinIcon,
    title: "friends see it",
    body: "the people you choose see it on their map. no group chat needed.",
  },
  {
    Icon: UsersIcon,
    title: "they join",
    body: "they tap join and come along. that's it.",
  },
]

export function LandingPage({ appUrl }: { appUrl: string }) {
  return (
    <div
      data-landing
      className="intro-slides relative flex min-h-dvh flex-col bg-background text-foreground"
    >
      <IntroStyles />

      <header className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-6xl items-center gap-2 px-6 pt-3 lg:px-8 lg:pt-6">
        <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
          <FlameIcon className="size-3.5" />
        </span>
        <span className="text-sm font-semibold">sponti</span>
      </header>

      <main className="flex flex-col">
        <Part kind="what" headingLevel={1}>
          <div className="mt-6 flex flex-col gap-6">
            <a
              href={appUrl}
              data-landing-cta
              className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors outline-none hover:bg-accent/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px lg:w-fit"
            >
              open sponti
              <ArrowRightIcon className="size-4" />
            </a>
            <div data-landing-qr className={cn(DESKTOP, "items-center gap-4")}>
              <PhoneQr
                url={appUrl}
                alt="qr code to open sponti"
                className="size-28 shrink-0 rounded-xl p-1.5"
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">made for your phone</p>
                <p className="text-sm text-muted-foreground">
                  scan this to open sponti there.
                </p>
              </div>
            </div>
          </div>
        </Part>

        <Part kind="why" flip>
          <Source />
        </Part>

        <Part kind="how" flip={false}>
          <ol className="mt-6 flex flex-col gap-4">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
                  <Icon className="size-4" />
                </span>
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <p className="text-sm font-semibold">
                    <span className="sr-only">{`step ${i + 1}: `}</span>
                    {title}
                  </p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Part>
      </main>

      <footer className="border-t border-border/60 px-6 py-4">
        <LegalLinks />
      </footer>
    </div>
  )
}

/** One part of the page: the slide's art and its words. */
function Part({
  kind,
  flip = false,
  headingLevel = 2,
  children,
}: {
  kind: Kind
  /** Wide screens: the art on the right instead of the left. */
  flip?: boolean
  headingLevel?: 1 | 2
  children?: ReactNode
}) {
  const copy = INTRO_COPY[kind]
  const Heading = headingLevel === 1 ? "h1" : "h2"
  return (
    <section
      data-landing-part={kind}
      aria-labelledby={`landing-${kind}`}
      className="relative isolate flex min-h-dvh flex-col overflow-hidden lg:mx-auto lg:grid lg:min-h-0 lg:w-full lg:max-w-6xl lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-20"
    >
      {/* Phone: the art fills the section, fading into the page under the
          words. Wide: a rounded panel showing the art's top, where the
          figures are; the fade the words sit on falls below its edge. */}
      <div
        className={cn(
          "absolute inset-0 isolate -z-10 overflow-hidden lg:relative lg:z-0 lg:mx-auto lg:aspect-[4/5] lg:h-[36rem] lg:max-h-[78dvh] lg:rounded-[2.5rem] lg:border lg:border-border/60",
          flip && "lg:order-2"
        )}
      >
        <div className="absolute inset-x-0 top-0 h-full lg:h-[160%]">
          <Backdrop kind={kind} />
        </div>
      </div>

      <div className="relative mt-auto flex flex-col px-6 pt-[60dvh] pb-12 lg:mt-0 lg:max-w-md lg:px-0 lg:pt-0 lg:pb-0">
        <p className="text-sm font-medium text-muted-foreground">
          {copy.eyebrow}
        </p>
        <Heading
          id={`landing-${kind}`}
          className="mt-2 text-3xl leading-tight font-medium tracking-tight text-balance"
        >
          {copy.title}
        </Heading>
        <p className="mt-3 text-base text-muted-foreground">{copy.body}</p>
        {children}
      </div>
    </section>
  )
}
