"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Flame } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"

const slides = [
  {
    title: "Make a plan without making it a thing.",
    body: "Light a flare when you are open to company. Friends can join if it fits.",
    tone: "now",
  },
  {
    title: "Quiet by default.",
    body: "Share with the right people instead of waking up every group chat you know.",
    tone: "quiet",
  },
  {
    title: "Now, soon, or later.",
    body: "The map shows what is alive right now. The calendar keeps the rest close.",
    tone: "time",
  },
]

export default function OnboardingPage() {
  const { status } = useAuth()
  const [slide, setSlide] = useState(0)
  const active = slides[slide]
  const isLast = slide === slides.length - 1
  const primaryHref = status === "authenticated" ? "/" : "/register"

  return (
    <main className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col">
      <header className="flex items-center justify-between px-6 pt-8 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Flame className="size-4" />
          </span>
          <span className="text-lg font-semibold">Sponti</span>
        </div>
        <Link
          href={status === "authenticated" ? "/" : "/login"}
          className="text-sm font-medium text-muted-foreground"
        >
          {status === "authenticated" ? "Home" : "Sign in"}
        </Link>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-5">
        <div className="flex items-center py-1">
          <FlareScene tone={active.tone} />
        </div>

        <div>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex gap-1.5" aria-label={`Step ${slide + 1} of 3`}>
              {slides.map((item, index) => (
                <span
                  key={item.title}
                  className={`h-1.5 rounded-full transition-all ${
                    index === slide ? "w-8 bg-accent" : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-accent">{slide + 1} / 3</span>
          </div>

          <h1 className="text-[28px] leading-[1.05] font-semibold tracking-normal">
            {active.title}
          </h1>
          <p className="mt-3 max-w-[20rem] text-sm leading-5 text-muted-foreground">
            {active.body}
          </p>

          <div className="mt-5">
            {isLast ? (
              <Button
                asChild
                variant="secondary"
                className="h-12 w-full rounded-full bg-accent text-base text-accent-foreground hover:bg-accent/90"
              >
                <Link href={primaryHref}>
                  {status === "authenticated" ? "Go home" : "Create account"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                className="h-12 w-full rounded-full bg-accent text-base text-accent-foreground hover:bg-accent/90"
                onClick={() => setSlide((current) => current + 1)}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function FlareScene({ tone }: { tone: string }) {
  const quiet = tone === "quiet"
  const time = tone === "time"

  return (
    <div className="relative h-44 w-full">
      <div className="absolute inset-x-8 top-3 h-[9.5rem] rounded-[28px] border border-border bg-secondary/60" />
      <div className="absolute inset-x-14 top-8 h-[6.5rem] rounded-full border border-border/80" />
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <span className="absolute size-32 rounded-full bg-accent/5" />
        <span className="absolute size-[5.5rem] rounded-full bg-accent/10" />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/20">
          <Flame className="size-7" />
        </span>
      </div>

      <SignalDot className="top-8 left-16" label={quiet ? "A" : "M"} muted={quiet} />
      <SignalDot className="right-14 bottom-11" label={time ? "Fri" : "S"} wide={time} />
      <SignalDot className="bottom-6 left-24" label={quiet ? "3" : "A"} muted={quiet} />

      {quiet && (
        <div className="absolute right-8 bottom-8 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm">
          close friends only
        </div>
      )}
      {time && (
        <div className="absolute right-8 bottom-8 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm">
          map now · calendar later
        </div>
      )}
    </div>
  )
}

function SignalDot({
  className,
  label,
  muted = false,
  wide = false,
}: {
  className: string
  label: string
  muted?: boolean
  wide?: boolean
}) {
  return (
    <div
      className={`absolute flex h-11 items-center justify-center rounded-full text-sm font-semibold shadow-md ${
        wide ? "w-14 px-3" : "w-11"
      } ${muted ? "bg-muted text-muted-foreground" : "bg-foreground text-background"} ${className}`}
    >
      {label}
    </div>
  )
}
