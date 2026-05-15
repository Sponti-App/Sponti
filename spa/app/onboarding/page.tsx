"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock3, Coffee, Flame, MapPin, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

const slides = [
  {
    eyebrow: "01 · map",
    title: <>See flares near you.</>,
    body: "The map shows what friends are doing now or soon, with the place, time, and who is going.",
    Illustration: MapFlareIllustration,
  },
  {
    eyebrow: "02 · host",
    title: <>Light a flare fast.</>,
    body: "Choose the activity, time, place, and guest limit before it goes live.",
    Illustration: ComposeIllustration,
  },
  {
    eyebrow: "03 · audience",
    title: <>Choose who sees it.</>,
    body: "Send a flare to a circle, selected friends, or make it open when that fits.",
    Illustration: AudienceIllustration,
  },
]

export default function OnboardingPage() {
  const [slide, setSlideState] = useState(0)
  const active = slides[slide]
  const isLast = slide === slides.length - 1
  const ActiveIllustration = active.Illustration

  const setSlide = (nextSlide: number) => {
    setSlideState(Math.min(Math.max(nextSlide, 0), slides.length - 1))
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <OnboardingStyles />
      <header className="flex h-[58px] shrink-0 items-center justify-between px-6 pt-2">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-normal">Sponti</span>
        </div>
        <Link
          href="/login"
          className="min-h-11 px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <section className="flex min-h-0 flex-1 flex-col px-6 pb-5">
        <Progress value={slide} />

        <div className="flex min-h-0 flex-1 flex-col" aria-live="polite">
          <div key={slide} className="sponti-slide flex min-h-0 flex-1 flex-col">
            <div className="relative mt-5 h-[320px] overflow-hidden rounded-[22px] border border-border bg-secondary/60">
              <ActiveIllustration />
            </div>

            <div className="mt-7">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium tracking-normal text-accent">
                <span className="h-px w-3.5 bg-accent" />
                {active.eyebrow}
              </div>
              <h1 className="max-w-[21rem] text-[32px] leading-[1.06] font-bold tracking-normal text-foreground [&_em]:not-italic [&_em]:text-foreground">
                {active.title}
              </h1>
              <p className="mt-3 max-w-[20rem] text-[15px] leading-6 text-muted-foreground">
                {active.body}
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-5">
              <Button
                asChild={isLast}
                type={isLast ? undefined : "button"}
                className="h-[52px] w-full rounded-full bg-accent text-[15px] font-medium text-accent-foreground shadow-sm hover:bg-accent/90"
                onClick={isLast ? undefined : () => setSlide(slide + 1)}
              >
                {isLast ? (
                  <Link href="/register">
                    Create account
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              {isLast ? (
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <Link href="/login">I have an account</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setSlide(slides.length - 1)}
                >
                  Skip
                </Button>
              )}

              {isLast && (
                <p className="pt-1 text-center text-[11.5px] leading-5 text-muted-foreground">
                  By continuing, you agree to Sponti&apos;s{" "}
                  <Link
                    href="/menu/terms"
                    className="text-foreground underline underline-offset-2"
                  >
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/menu/privacy"
                    className="text-foreground underline underline-offset-2"
                  >
                    Privacy
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function BrandMark() {
  return (
    <span className="sponti-brand-mark relative flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
      <Flame className="size-3.5" />
    </span>
  )
}

function Progress({ value }: { value: number }) {
  return (
    <div
      className="flex gap-1.5 pt-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={slides.length}
      aria-valuenow={value + 1}
      aria-label="Onboarding progress"
    >
      {slides.map((item, index) => (
        <span
          key={item.eyebrow}
          className="h-[3px] flex-1 overflow-hidden rounded-full bg-border"
        >
          <span
            className={`block h-full origin-left rounded-full bg-accent transition-transform duration-500 motion-reduce:duration-200 ${
              index <= value ? "scale-x-100" : "scale-x-0"
            }`}
          />
        </span>
      ))}
    </div>
  )
}

function MapFlareIllustration() {
  return (
    <div className="sponti-illo absolute inset-0" aria-hidden="true">
      <div className="sponti-grid" />
      <div className="sponti-pill sponti-pill-live sponti-pop top-5 left-5">
        live now · 3 nearby
      </div>
      <div className="sponti-pill sponti-pop top-5 right-5 text-muted-foreground [animation-delay:1.3s]">
        tonight
      </div>
      <div className="sponti-flare-rings">
        <span />
        <span />
        <span />
      </div>
      <div className="sponti-flare-core">
        <Flame className="size-7" />
      </div>
      <Avatar className="top-[26%] left-[18%]" label="M" />
      <Avatar className="bottom-[22%] left-[26%] [animation-delay:0.2s]" label="A" />
      <Avatar className="top-[32%] right-[16%] size-8 text-[11px] [animation-delay:0.35s]" label="S" />
      <Avatar
        className="right-[22%] bottom-[26%] size-8 border border-border bg-background text-[11px] text-muted-foreground [animation-delay:0.5s]"
        label="J"
      />
    </div>
  )
}

function ComposeIllustration() {
  return (
    <div className="sponti-illo absolute inset-0" aria-hidden="true">
      <div className="sponti-grid" />
      <div className="absolute top-1/2 left-1/2 w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-background p-4 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)]">
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground">light a flare</div>
          <div className="mt-1 text-sm font-semibold">patio hang</div>
        </div>
        <ChipRow>
          <Chip selected icon={<Coffee className="size-3" />} delay="0.05s">
            hangout
          </Chip>
          <Chip delay="0.15s">food</Chip>
          <Chip delay="0.25s">sports</Chip>
        </ChipRow>
        <ChipRow>
          <Chip selected icon={<Clock3 className="size-3" />} delay="0.45s">
            now
          </Chip>
          <Chip delay="0.55s">+1h</Chip>
          <Chip delay="0.65s">7pm</Chip>
        </ChipRow>
        <ChipRow>
          <Chip selected icon={<MapPin className="size-3" />} delay="0.85s">
            Courtyard
          </Chip>
          <Chip delay="0.95s">current loc</Chip>
        </ChipRow>
        <ChipRow className="mb-0">
          <Chip selected icon={<Users className="size-3" />} delay="1.15s">
            8 guests
          </Chip>
        </ChipRow>
        <span className="sponti-ignite absolute right-4 -bottom-5 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
          <Flame className="size-5" />
        </span>
      </div>
    </div>
  )
}

function AudienceIllustration() {
  return (
    <div className="sponti-illo absolute inset-0" aria-hidden="true">
      <div className="sponti-grid" />
      <div className="absolute top-1/2 left-1/2 flex w-[260px] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-[18px] border border-border bg-background p-4 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)]">
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          broadcast to
        </div>
        <AudienceCard label="inner circle" count="4 people" selected />
        <AudienceCard label="close friends" count="8 people" />
        <AudienceCard label="pick friends" count="custom" />
        <div className="mt-2 rounded-xl border border-border px-3 py-2">
          <div className="text-xs font-medium">guest limit</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            up to 8 people
          </div>
        </div>
      </div>
    </div>
  )
}

function Avatar({ className, label }: { className: string; label: string }) {
  return (
    <span
      className={`sponti-avatar absolute flex size-9 items-center justify-center rounded-full bg-foreground text-[13px] font-semibold text-background shadow-[0_6px_14px_-4px_rgba(0,0,0,0.25)] ${className}`}
    >
      {label}
    </span>
  )
}

function ChipRow({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`mb-2 flex flex-wrap gap-1.5 ${className}`}>{children}</div>
}

function Chip({
  children,
  delay,
  selected = false,
  icon,
}: {
  children: React.ReactNode
  delay: string
  selected?: boolean
  icon?: React.ReactNode
}) {
  return (
    <span
      className={`sponti-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-secondary text-foreground"
      }`}
      style={{ animationDelay: delay }}
    >
      {icon}
      {children}
    </span>
  )
}

function AudienceCard({
  label,
  count,
  selected = false,
}: {
  label: string
  count: string
  selected?: boolean
}) {
  return (
    <div
      className={`sponti-chip flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
        selected ? "border-accent bg-accent/5 text-accent" : "border-border bg-background"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  )
}

function OnboardingStyles() {
  return (
    <style>{`
      .sponti-brand-mark::after {
        content: "";
        position: absolute;
        inset: -3px;
        border-radius: 999px;
        border: 1.5px solid var(--accent);
        animation: sponti-brand-pulse 2.6s ease-out infinite;
      }

      .sponti-slide {
        animation: sponti-slide-in 420ms cubic-bezier(.4,0,.2,1);
      }

      .sponti-illo {
        background: var(--secondary);
      }

      .sponti-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(color-mix(in oklch, var(--foreground) 4%, transparent) 1px, transparent 1px),
          linear-gradient(90deg, color-mix(in oklch, var(--foreground) 4%, transparent) 1px, transparent 1px);
        background-size: 28px 28px;
        background-position: center;
        mask-image: radial-gradient(ellipse at center, black 35%, transparent 75%);
      }

      .sponti-pill {
        position: absolute;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--background);
        padding: 6px 11px 6px 8px;
        font-size: 11px;
        font-weight: 500;
        box-shadow: 0 6px 24px -8px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.04);
      }

      .sponti-pill-live {
        border-color: color-mix(in oklch, var(--accent) 35%, var(--border));
        background: var(--background);
        color: color-mix(in oklch, var(--accent) 80%, var(--foreground));
      }

      .sponti-flare-rings {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 200px;
        height: 200px;
        transform: translate(-50%, -50%);
      }

      .sponti-flare-rings span {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: var(--accent);
        opacity: 0;
        animation: sponti-ring 3s cubic-bezier(.2,.6,.2,1) infinite;
      }

      .sponti-flare-rings span:nth-child(2) {
        animation-delay: 1s;
      }

      .sponti-flare-rings span:nth-child(3) {
        animation-delay: 2s;
      }

      .sponti-flare-core {
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 2;
        display: grid;
        width: 64px;
        height: 64px;
        place-items: center;
        border-radius: 999px;
        background: var(--accent);
        color: var(--accent-foreground);
        box-shadow: 0 10px 24px -6px rgba(196,64,64,.6), inset 0 1px 0 rgba(255,255,255,.25);
        transform: translate(-50%, -50%);
        animation: sponti-core 3s ease-in-out infinite;
      }

      .sponti-avatar {
        animation: sponti-avatar-in 1.4s cubic-bezier(.2,.6,.2,1) both, sponti-float 5s ease-in-out infinite;
      }

      .sponti-chip {
        animation: sponti-chip-in 500ms cubic-bezier(.2,.7,.2,1) both;
      }

      .sponti-ignite {
        opacity: 0;
        transform: scale(.5) rotate(-10deg);
        animation: sponti-ignite 600ms 1.45s cubic-bezier(.2,.7,.2,1) forwards;
      }

      .sponti-audience-ring {
        animation: sponti-audience-pulse 2.4s ease-in-out infinite;
      }

      .sponti-pop {
        animation: sponti-pop-in 700ms 900ms cubic-bezier(.2,.7,.2,1) both;
      }

      @keyframes sponti-brand-pulse {
        0% { transform: scale(.85); opacity: .55; }
        100% { transform: scale(1.35); opacity: 0; }
      }

      @keyframes sponti-slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes sponti-ring {
        0% { transform: scale(.25); opacity: .35; }
        80% { opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }

      @keyframes sponti-core {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.04); }
      }

      @keyframes sponti-avatar-in {
        from { opacity: 0; transform: translateY(14px) scale(.7); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes sponti-float {
        0%, 100% { translate: 0 0; }
        50% { translate: 0 -6px; }
      }

      @keyframes sponti-chip-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes sponti-ignite {
        0% { opacity: 0; transform: scale(.4) rotate(-12deg); }
        60% { opacity: 1; transform: scale(1.15) rotate(4deg); }
        100% { opacity: 1; transform: scale(1) rotate(0); }
      }

      @keyframes sponti-audience-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(196,64,64,.25); }
        50% { box-shadow: 0 0 0 8px rgba(196,64,64,0); }
      }

      @keyframes sponti-pop-in {
        from { opacity: 0; transform: translateY(6px) scale(.9); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .sponti-brand-mark::after,
        .sponti-slide,
        .sponti-flare-rings span,
        .sponti-flare-core,
        .sponti-avatar,
        .sponti-chip,
        .sponti-ignite,
        .sponti-audience-ring,
        .sponti-pop {
          animation-duration: 200ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 200ms !important;
        }

        .sponti-slide {
          transform: none;
        }
      }
    `}</style>
  )
}
