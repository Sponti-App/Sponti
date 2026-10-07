"use client"

// PROTOTYPE (#506), direction C, "brand world": B's pitch, retold in the
// brand exploration (docs/media/sponti brand/). Scenes before screens: the
// hero is a moment (the rooftop), the app arrives in "how it works". Cream,
// indigo and one coral flare; condensed display type like the pitch deck;
// soft blooms where the scenes already glow. The page keeps the brand
// palette in both colour schemes, and the phones keep the app's light look,
// since the app itself doesn't change (this is the landing page's voice only).

import Image from "next/image"
import {
  BellIcon,
  CalendarBlankIcon,
  FlameIcon,
  LockIcon,
  MapTrifoldIcon,
  type Icon,
} from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { WHO_REPORT_URL } from "@/components/intro-slides"
import { cn } from "@/lib/utils"
import {
  ComposeScreen,
  DesktopQr,
  JoinScreen,
  Logo,
  MapScreen,
  OpenSponti,
  Phone,
  Reveal,
  TestingNote,
  spotlight,
  useInView,
  usePointerVar,
  useScrollVar,
} from "./_shared"
import { APPS, PLANS, Typewriter, useLit } from "./_variant-b"

/** The brand scenes, with where each one already glows (in % of the image),
 * so a bloom can sit on the light that's painted there. */
const SCENES = {
  rooftop: {
    src: "/landing/brand/rooftop.webp",
    ratio: 1536 / 1024,
    alt: "friends on a rooftop at sunset, gathered around a glowing light",
    glow: [{ x: 55.6, y: 57.8, size: 22 }],
  },
  park: {
    src: "/landing/brand/park.webp",
    ratio: 1672 / 941,
    alt: "a park by the river at sunset, small groups of friends around little lights",
    glow: [
      { x: 38.2, y: 58.5, size: 9 },
      { x: 84.8, y: 64, size: 7 },
      { x: 63.2, y: 55.5, size: 5 },
      { x: 31, y: 50.5, size: 4 },
    ],
  },
  walk: {
    src: "/landing/brand/walk.webp",
    ratio: 1122 / 1402,
    alt: "three friends and a dog walking along the river towards the sun",
    glow: [{ x: 62, y: 35.5, size: 26 }],
  },
  crowd: {
    src: "/landing/brand/crowd.webp",
    ratio: 1122 / 1402,
    alt: "a crowd with raised hands, turned towards a bright light",
    glow: [{ x: 54.5, y: 41.5, size: 30 }],
  },
} as const

type SceneName = keyof typeof SCENES

export function VariantC() {
  return (
    <div className="lp-brand flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/30 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 lg:px-8">
          <Logo />
          <OpenSponti className="h-9 px-4 text-xs shadow-none" />
        </div>
      </header>
      <Hero />
      <Problem />
      <How />
      <Now />
      <Lines />
      <Why />
      <Closing />
      <footer className="border-t border-border/60 px-6 py-6">
        <LegalLinks />
      </footer>
    </div>
  )
}

/**
 * A scene that covers its box like `object-fit: cover`, but as a box of the
 * image's own ratio, so blooms placed in % of the image stay on their spot
 * at any viewport size. `move` adds a transform (parallax, pan).
 */
function Scene({
  name,
  className,
  move,
  priority = false,
  bloom = true,
  children,
}: {
  name: SceneName
  className?: string
  move?: string
  priority?: boolean
  bloom?: boolean
  children?: React.ReactNode
}) {
  const scene = SCENES[name]
  return (
    <div
      className={cn("lp-scene relative overflow-hidden", className)}
      style={{ ["--ratio" as string]: scene.ratio }}
    >
      <div
        className="lp-scene-box absolute top-1/2 left-1/2 transition-transform duration-300 ease-out"
        style={{ transform: move ?? "translate(-50%, -50%)" }}
      >
        <Image
          src={scene.src}
          alt={scene.alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 100vw, 200vw"
          className="object-cover"
        />
        {bloom &&
          scene.glow.map((g, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="lp-bloom"
              style={{
                left: `${g.x}%`,
                top: `${g.y}%`,
                width: `${g.size}%`,
                animationDelay: `${i * -1.7}s`,
              }}
            />
          ))}
        {children}
      </div>
    </div>
  )
}

function depth(px: number) {
  return `translate3d(calc(var(--mx, 0) * ${px}px), calc(var(--my, 0) * ${px}px), 0)`
}

/** Type on cream up top, then the rooftop scene in a big frame, moving a
 * little with the cursor, with two small app moments floating over it. */
function Hero() {
  const ref = usePointerVar<HTMLElement>()
  return (
    <section ref={ref} className="px-3 pt-10 pb-6 text-center lg:pt-16">
      <div className="px-3">
        <Reveal>
          <TestingNote className="justify-center rounded-full bg-muted px-3 py-1.5" />
        </Reveal>
        <Reveal delay={100}>
          <h1 className="lp-display mx-auto mt-6 max-w-5xl text-[3.75rem] text-balance lg:text-[8.5rem]">
            turn &ldquo;we should&rdquo; into{" "}
            <span className="lp-coral">&ldquo;we&apos;re here.&rdquo;</span>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-lg text-base text-muted-foreground lg:text-lg">
            sponti is for plans with friends, right now or soon. light a flare,
            and whoever&apos;s free comes along. no group chat needed.
          </p>
        </Reveal>
        <Reveal delay={300} className="mt-8 flex justify-center">
          <OpenSponti className="w-full max-w-xs lg:w-fit" />
        </Reveal>
      </div>
      <Reveal delay={200} className="relative mx-auto mt-12 max-w-7xl lg:mt-16">
        <Scene
          name="rooftop"
          priority
          className="h-[58svh] min-h-[24rem] rounded-[2.5rem] lg:h-[80svh]"
          move={`translate(-50%, -50%) ${depth(-12)} scale(1.06)`}
        />
        <FloatCard
          className="bottom-5 left-5 lg:bottom-10 lg:left-10"
          px={22}
          delay="0s"
          reveal={700}
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
          className="top-[30%] right-10 hidden sm:block"
          px={32}
          delay="-3s"
          reveal={1000}
        >
          <span className="size-2 rounded-full bg-accent" />
          <span className="text-sm">sam and 4 others joined</span>
        </FloatCard>
      </Reveal>
      <DesktopQr className="mx-auto mt-10 w-fit text-left" />
    </section>
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
    <div className={cn("absolute", className)}>
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

/** Five apps to plan one ___, folding into one soft flare as you scroll. */
function Problem() {
  const ref = useScrollVar<HTMLElement>()
  const lit = useLit(ref)
  const gather = "clamp(0, calc((var(--p, 0) - 0.3) * 3.3), 1)"
  return (
    <section
      ref={ref}
      className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2 lg:px-8 lg:py-36"
    >
      <Reveal>
        <p className="lp-eyebrow">digital overdose, social famine.</p>
        <h2 className="lp-display mt-4 text-5xl lg:text-7xl">
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
      <div className="relative mx-auto h-80 w-full max-w-sm">
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
          <span aria-hidden="true" className="lp-orb-ring" />
          <span
            aria-hidden="true"
            className="lp-orb-ring"
            style={{ animationDelay: "0.4s" }}
          />
          <FlameIcon
            weight="fill"
            className="lp-flare-icon size-12 text-foreground/85 lg:size-14"
          />
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

/** The one dark band: indigo, the app's phones, a coral glow in the corner. */
function How() {
  return (
    <section className="lp-indigo relative isolate mx-3 overflow-hidden rounded-[2.5rem] px-6 py-20 lg:mx-auto lg:w-[calc(100%-3rem)] lg:max-w-7xl lg:px-10 lg:py-28">
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
        <h2 className="lp-display mt-4 text-5xl lg:text-8xl">
          one tap. <span className="lp-coral">broadcast</span> or join.
        </h2>
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-3">
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
        className="group relative flex flex-col overflow-hidden rounded-[2rem] bg-white/[0.06] p-6 ring-1 ring-white/10 transition-transform duration-300 hover:-translate-y-1"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(260px circle at var(--sx, 50%) var(--sy, 0%), rgb(255 152 107 / 0.22), transparent 70%)",
          }}
        />
        <span className="lp-display text-3xl text-[#FF986B]">{n}</span>
        <p className="mt-2 text-lg font-semibold">{title}</p>
        <p className="text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-center">
          <Phone className="lp-app w-[13rem] border-white/10 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] transition-transform duration-500 group-hover:-translate-y-1">
            <Screen play={inView} />
          </Phone>
        </div>
      </div>
    </Reveal>
  )
}

/** The park scene, panning as you scroll, with flares popping where it glows. */
const NOW_CHIPS = [
  { glow: 0, label: "drinks on the terrace", meta: "live · 5 going" },
  { glow: 1, label: "ping pong", meta: "open to all · 2 going" },
  { glow: 2, label: "picnic on the hill", meta: "in 20 min" },
]

function Now() {
  const ref = useScrollVar<HTMLElement>()
  const [chips, inView] = useInView<HTMLDivElement>(0.4)
  const glow = SCENES.park.glow
  // Where the frame is narrower than the scene (phones), it pans across it
  // as you scroll: 0 shows the left edge, 1 the right.
  const pan = "clamp(0, calc((var(--p, 0) - 0.25) * 2), 1)"
  return (
    <section ref={ref} className="py-24 lg:py-36">
      <Reveal className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <p className="lp-eyebrow">map = now.</p>
        <h2 className="lp-display mt-4 max-w-3xl text-5xl lg:text-8xl">
          what&apos;s happening <span className="lp-coral">now.</span>
        </h2>
        <p className="mt-5 max-w-md text-muted-foreground lg:text-lg">
          every flare is a little light on your friends&apos; map. open the app
          and see who&apos;s out, and where.
        </p>
      </Reveal>
      <div ref={chips} className="mx-3 mt-12 lg:mx-auto lg:max-w-7xl">
        <Scene
          name="park"
          className="h-[70svh] max-h-[44rem] min-h-[26rem] rounded-[2.5rem]"
          move={`translate(calc(-50% + (100% - 100cqw) / 2 * (1 - 2 * ${pan})), -50%)`}
        >
          {NOW_CHIPS.map((chip, i) => {
            const g = glow[chip.glow]
            return (
              <span
                key={chip.label}
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
    <section className="mx-auto grid w-full max-w-6xl gap-x-12 gap-y-14 px-6 pb-24 sm:grid-cols-2 lg:px-8 lg:pb-36">
      {LINES.map(({ Icon, line, body }, i) => (
        <Reveal key={body} delay={(i % 2) * 120}>
          <div className="group border-t border-border pt-6">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-foreground">
              <Icon className="size-5" />
            </span>
            <p className="lp-display mt-5 text-4xl lg:text-5xl">{line}</p>
            <p className="mt-3 max-w-sm text-muted-foreground">{body}</p>
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
      className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-24 lg:grid-cols-[1fr_26rem] lg:px-8 lg:pb-36"
    >
      <Reveal>
        <p className="lp-eyebrow">why it exists</p>
        <h2 className="lp-display mt-4 text-5xl lg:text-7xl">
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
        <h2 className="lp-display text-7xl text-balance lg:text-[9rem]">
          light a <span className="lp-coral">flare.</span>
        </h2>
        <p className="max-w-md text-base lg:text-lg">
          see who&apos;s up for something, right now or soon.
        </p>
        <OpenSponti className="w-full max-w-xs lg:w-fit" />
        <TestingNote className="justify-center" />
        <DesktopQr className="mt-2 text-left" />
      </Reveal>
    </section>
  )
}

/** Direction C's palette and type, scoped to the page. */
export function BrandStyles() {
  return (
    <style>{`
      .lp-brand {
        --cream: #f7f0e6; --indigo: #2e205f; --coral: #ff986b;
        --coral-ink: #d65d2c; --coral-text: #a84a22;
        --background: var(--cream);
        --foreground: var(--indigo);
        --card: #fcf8f2;
        --card-foreground: var(--indigo);
        --muted: color-mix(in oklch, var(--indigo) 7%, var(--cream));
        --muted-foreground: color-mix(in oklch, var(--indigo) 72%, var(--cream));
        --border: color-mix(in oklch, var(--indigo) 13%, var(--cream));
        --primary: var(--coral);
        --accent: var(--coral);
        --accent-foreground: var(--indigo);
        --accent-ink: var(--coral-text);
        --ring: var(--coral);
        --flare-invite: oklch(0.87 0.07 315);
        --flare-open: oklch(0.87 0.07 185);
        color-scheme: light;
        background: var(--background);
        color: var(--foreground);
      }
      .lp-brand .lp-indigo {
        --background: var(--indigo);
        --foreground: var(--cream);
        --muted-foreground: color-mix(in oklch, var(--cream) 72%, var(--indigo));
        --coral-ink: var(--coral);
        background: var(--indigo); color: var(--cream);
      }
      /* The phones show the app as it is, in its light look. */
      .lp-brand .lp-app {
        --background: oklch(0.97 0.015 346); --foreground: oklch(0.25 0.06 346);
        --card: oklch(0.99 0.007 346); --muted: oklch(0.93 0.02 346);
        --muted-foreground: oklch(0.5 0.04 346); --border: oklch(0.88 0.025 346);
        --primary: oklch(0.8041 0.126 52.09); --accent: oklch(0.8041 0.126 52.09);
        --accent-foreground: oklch(0.25 0.06 50);
        --flare-invite: oklch(0.87 0.07 315); --flare-invite-ink: oklch(0.36 0.09 315);
        --flare-open: oklch(0.87 0.07 185); --flare-open-ink: oklch(0.36 0.09 185);
        --flare-invite-tint: oklch(0.94 0.035 315); --flare-open-tint: oklch(0.94 0.035 185);
        color: var(--foreground);
      }
      .lp-display {
        font-family: var(--font-display), var(--font-sans), sans-serif;
        font-stretch: 82%; font-variation-settings: "wdth" 82, "opsz" 96;
        font-weight: 650; line-height: .95; letter-spacing: -0.012em;
      }
      .lp-eyebrow { font-size: .875rem; font-weight: 600; color: var(--coral-text); }
      .lp-indigo .lp-eyebrow { color: var(--coral); }
      .lp-coral { color: var(--coral-ink); }
      .lp-scene { container-type: size; }
      .lp-scene-box {
        aspect-ratio: var(--ratio);
        width: max(100cqw, 100cqh * var(--ratio));
      }
      .lp-bloom {
        position: absolute; aspect-ratio: 1; translate: -50% -50%; border-radius: 9999px;
        pointer-events: none; mix-blend-mode: screen;
        background: radial-gradient(circle, rgb(255 250 235 / .9) 0, rgb(255 200 150 / .5) 22%, rgb(255 152 107 / .18) 48%, transparent 70%);
        animation: lp-bloom 5.5s ease-in-out infinite;
      }
      @keyframes lp-bloom { 0%,100% { scale: .85; opacity: .65 } 50% { scale: 1.15; opacity: 1 } }
      .lp-orb {
        background: radial-gradient(circle at 50% 45%, #fff6ea 0%, #ffd2b0 32%, var(--coral) 70%);
        box-shadow: 0 0 50px -10px var(--coral);
        transition: box-shadow .8s ease;
      }
      .lp-orb[data-lit="true"] {
        box-shadow: 0 0 120px 30px rgb(255 152 107 / .45), 0 0 50px 8px rgb(255 200 150 / .7);
        animation: lp-orb-glow 3.2s ease-in-out .6s infinite;
      }
      @keyframes lp-orb-glow {
        0%,100% { box-shadow: 0 0 120px 30px rgb(255 152 107 / .45), 0 0 50px 8px rgb(255 200 150 / .7) }
        50% { box-shadow: 0 0 170px 50px rgb(255 152 107 / .32), 0 0 60px 14px rgb(255 200 150 / .8) }
      }
      .lp-orb-ring { position: absolute; inset: 0; border-radius: 9999px; background: radial-gradient(circle, transparent 55%, rgb(255 152 107 / .45) 70%, transparent 72%); opacity: 0; pointer-events: none; }
      .lp-orb[data-lit="true"] .lp-orb-ring { animation: lp-spread 1.6s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes lp-spread { from { transform: scale(1); opacity: 1 } to { transform: scale(2.8); opacity: 0 } }
      .lp-orb[data-lit="true"] .lp-flare-icon { transform: scale(1.12); animation: lp-flicker 2.2s ease-in-out .6s infinite; transform-origin: 50% 85%; }
      @media (prefers-reduced-motion: reduce) {
        .lp-bloom, .lp-orb[data-lit="true"], .lp-orb[data-lit="true"] .lp-orb-ring, .lp-orb[data-lit="true"] .lp-flare-icon { animation: none; }
      }
    `}</style>
  )
}
