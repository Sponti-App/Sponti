"use client"

// PROTOTYPE (#345): throwaway route, NOT production. Nothing links here.
// Question: should the app's icons move from Lucide to Iconoir or Phosphor?
// Renders real app surfaces with one library at a time, switchable via:
//   ?lib=iconoir|phosphor|lucide   (default iconoir; lucide is today's baseline)
//   &weight=light|regular|bold     (default regular, each library's default)
//   &theme=light|dark              (sets the app theme while on this page)
//   &bar=0                         (hide the prototype bar, for screenshots)
// Once a library is picked: record it on #345, delete this folder, and file
// the migration issue.

import { Suspense, useEffect, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import {
  CATEGORIES,
  ICONS,
  Icon,
  LIBS,
  type IconKey,
  type LibKey,
} from "./_sets"

export default function IconsPrototypePage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        prototypes are only available in development.
      </p>
    )
  }
  return (
    <Suspense>
      <Prototype />
    </Suspense>
  )
}

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

// The #315 option B visibility tints (plum = invite only, teal = open to all).
const PROTO_CSS = `
.proto-345 { --vis-l: 0.87; --vis-c: 0.07; --vis-ink-l: 0.36; --vis-ink-c: 0.09; }
.dark .proto-345 { --vis-l: 0.45; --vis-c: 0.08; --vis-ink-l: 0.95; --vis-ink-c: 0.03; }
nextjs-portal { display: none; }
nav[aria-label="Primary"]:not(.proto-nav) { display: none; }
`
const HUE = { private: 315, public: 185 } as const
const visFill = (v: keyof typeof HUE) =>
  `oklch(var(--vis-l) var(--vis-c) ${HUE[v]})`
const visInk = (v: keyof typeof HUE) =>
  `oklch(var(--vis-ink-l) var(--vis-ink-c) ${HUE[v]})`

function Prototype() {
  const params = useSearchParams()
  const router = useRouter()
  const { setTheme } = useTheme()
  const lib = pick(
    params.get("lib"),
    ["iconoir", "phosphor", "lucide"],
    "iconoir"
  )
  const weight = pick(
    params.get("weight"),
    ["light", "regular", "bold"],
    "regular"
  )
  const theme = params.get("theme")
  const showBar = params.get("bar") !== "0"

  useEffect(() => {
    if (theme === "light" || theme === "dark") setTheme(theme)
  }, [theme, setTheme])

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const I = (key: IconKey, className = "h-5 w-5", fill = false) => (
    <Icon
      entry={ICONS[key]}
      lib={lib}
      weight={weight}
      className={className}
      fill={fill}
    />
  )

  return (
    <div className="proto-345 min-h-dvh bg-background text-foreground">
      <style>{PROTO_CSS}</style>
      {showBar && (
        <div className="sticky top-0 z-20 flex flex-wrap gap-2 bg-stone-900 px-3 py-2 font-mono text-xs text-stone-100">
          <Seg
            value={lib}
            options={["iconoir", "phosphor", "lucide"]}
            onChange={(v) => set("lib", v)}
          />
          <Seg
            value={weight}
            options={["light", "regular", "bold"]}
            onChange={(v) => set("weight", v)}
          />
          <Seg
            value={theme === "dark" ? "dark" : "light"}
            options={["light", "dark"]}
            onChange={(v) => set("theme", v)}
          />
        </div>
      )}

      <header className="border-b border-border/60 px-4 pt-6 pb-4">
        <h1 className="text-lg font-semibold">{LIBS[lib].name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {LIBS[lib].version} · {weight} · {LIBS[lib].note}
        </p>
      </header>

      <Section title="bottom nav (phosphor shows its fill weight on the active tab)">
        <nav
          aria-label="Primary"
          className="proto-nav flex h-20 items-center justify-around rounded-lg bg-card px-2"
        >
          <NavItem label="home" active>
            {I("home", "h-5 w-5", true)}
          </NavItem>
          <NavItem label="feed">{I("feed")}</NavItem>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg">
            {I("flare", "h-6 w-6")}
          </span>
          <NavItem label="circles">{I("circles")}</NavItem>
          <NavItem label="my flares">{I("myFlares")}</NavItem>
        </nav>
      </Section>

      <Section title="header actions">
        <div className="flex items-center justify-between rounded-lg bg-card px-2 py-2">
          <IconButton label="back">{I("back")}</IconButton>
          <span className="text-base font-semibold">pickup football</span>
          <div className="flex">
            <IconButton label="share">{I("share")}</IconButton>
            <IconButton label="edit">{I("edit")}</IconButton>
            <IconButton label="more">{I("more")}</IconButton>
          </div>
        </div>
      </Section>

      <Section title="categories as map pins (#315 option b)">
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map(({ label, entry }, i) => {
            const vis = i % 2 === 0 ? "private" : "public"
            return (
              <div
                key={label}
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card shadow-lg"
                style={{ background: visFill(vis), color: visInk(vis) }}
              >
                <Icon
                  entry={entry}
                  lib={lib}
                  weight={weight}
                  className="h-5 w-5"
                />
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map(({ label, entry }, i) => (
            <span
              key={label}
              className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs ${
                i === 4
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-border text-foreground"
              }`}
            >
              <Icon
                entry={entry}
                lib={lib}
                weight={weight}
                className="h-4 w-4"
              />
              {label}
            </span>
          ))}
        </div>
        <Gaps lib={lib} entries={CATEGORIES.map((c) => c.entry)} />
      </Section>

      <Section title="pin popover (#315 option b)">
        <div className="relative w-64 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl">
          <div
            className="flex h-9 items-center gap-1.5 pr-10 pl-3 text-xs font-medium"
            style={{ background: visFill("public"), color: visInk("public") }}
          >
            <Icon
              entry={CATEGORIES[4].entry}
              lib={lib}
              weight={weight}
              className="h-4 w-4"
            />
            <span className="opacity-60">·</span>
            open to all
            <button
              type="button"
              aria-label="close"
              className="absolute top-0 right-0 flex h-9 w-10 items-center justify-center"
            >
              {I("close", "h-4 w-4")}
            </button>
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold">
              pickup football at mauerpark
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> live ·
              ends in 1h 10m
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              by mia · 0.9 km · 6 going
            </p>
            <span className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-muted text-sm font-medium">
              see flare {I("chevronRight", "h-4 w-4")}
            </span>
          </div>
        </div>
      </Section>

      <Section title="flare card">
        <div className="flex items-center gap-3 rounded-lg border-l-[3px] border-l-accent bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">coffee at the canal</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Meta icon={I("clock", "h-3.5 w-3.5")}>ends in 42 min</Meta>
              <Meta icon={I("pin", "h-3.5 w-3.5")}>0.5 km</Meta>
              <Meta icon={I("circles", "h-3.5 w-3.5")}>4 going</Meta>
              <Meta icon={I("lock", "h-3.5 w-3.5")}>invite only</Meta>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
            {I("check", "h-3.5 w-3.5")} going
          </span>
        </div>
      </Section>

      <Section title="settings rows">
        <div className="divide-y divide-border/60 rounded-lg bg-card">
          {(
            [
              ["userCircle", "profile"],
              ["feed", "notifications"],
              ["shield", "privacy"],
              ["moon", "dark mode"],
              ["qr", "my qr code"],
              ["help", "faq"],
              ["megaphone", "send feedback"],
              ["logout", "sign out"],
            ] as [IconKey, string][]
          ).map(([key, label]) => (
            <div
              key={key}
              className="flex h-12 items-center gap-3 px-3 text-sm"
            >
              <span className="text-muted-foreground">{I(key)}</span>
              <span className="flex-1">{label}</span>
              <span className="text-muted-foreground">
                {I("chevronRight", "h-4 w-4")}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`every icon the app uses · ${lib} vs lucide`}>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(ICONS) as IconKey[]).map((key) => {
            const entry = ICONS[key]
            const gap = entry.gap?.[lib]
            return (
              <div
                key={key}
                title={gap}
                className={`flex flex-col items-center gap-1 rounded-lg bg-card px-1 py-2 ${
                  gap ? "ring-2 ring-destructive/60" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    entry={entry}
                    lib={lib}
                    weight={weight}
                    className="h-6 w-6"
                  />
                  {lib !== "lucide" && (
                    <Icon
                      entry={entry}
                      lib="lucide"
                      weight={weight}
                      className="h-4 w-4 text-muted-foreground/60"
                    />
                  )}
                </div>
                <span className="text-center text-xs leading-tight text-muted-foreground">
                  {entry.name}
                </span>
              </div>
            )
          })}
        </div>
        <Gaps lib={lib} entries={Object.values(ICONS)} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border/60 px-4 py-4">
      <h2 className="mb-3 text-xs text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function IconButton({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-foreground"
    >
      {children}
    </button>
  )
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      {children}
    </span>
  )
}

function NavItem({
  label,
  active = false,
  children,
}: {
  label: string
  active?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`flex w-16 flex-col items-center gap-1 text-xs ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
      {label}
    </span>
  )
}

function Gaps({
  lib,
  entries,
}: {
  lib: LibKey
  entries: { name: string; gap?: Partial<Record<LibKey, string>> }[]
}) {
  const gaps = entries.filter((e) => e.gap?.[lib])
  if (gaps.length === 0) return null
  return (
    <p className="mt-3 text-xs text-destructive">
      gaps: {gaps.map((e) => `${e.name} (${e.gap?.[lib]})`).join(" · ")}
    </p>
  )
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: T[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded border border-stone-600">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-2 py-1 ${o === value ? "bg-stone-100 text-stone-900" : ""}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
