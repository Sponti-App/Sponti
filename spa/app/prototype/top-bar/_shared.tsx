"use client"

// PROTOTYPE (#369) — throwaway. The prototype bar, the mock home (map,
// header, dock, nav) and the three takes on the share shortcut. Real
// components where they render without the app's providers (Avatar, Tabs,
// NavFlareButton, LegalLinks); look-alikes on mock data everywhere else.

import { useTheme } from "next-themes"
import {
  BellIcon,
  CalendarBlankIcon,
  FireIcon,
  HouseIcon,
  ListIcon,
  MapTrifoldIcon,
  PlusIcon,
  ShareNetworkIcon,
  UserPlusIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons"
import { NavFlareButton } from "@/components/bottom-nav"
import { LegalLinks } from "@/components/legal-links"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { ME, initialsOf } from "./_mock"

// ---- Prototype state -------------------------------------------------------

/** The open calls the bar switches between, as URL params. */
export const TOGGLES = {
  screen: [
    { key: "home", label: "home" },
    { key: "menu", label: "menu" },
    { key: "share", label: "share" },
    { key: "friends", label: "friends" },
  ],
  auth: [
    { key: "in", label: "signed in" },
    { key: "out", label: "signed out" },
  ],
  menu: [
    { key: "A", label: "menu a: page" },
    { key: "B", label: "menu b: drawer" },
  ],
  btn: [
    { key: "A", label: "share a: icon" },
    { key: "B", label: "share b: avatar+" },
    { key: "C", label: "share c: pill" },
  ],
  open: [
    { key: "qr", label: "opens qr" },
    { key: "link", label: "opens link" },
  ],
  card: [
    { key: "on", label: "handle card on" },
    { key: "off", label: "handle card off" },
  ],
  friends: [
    { key: "3", label: "3 friends" },
    { key: "0", label: "0 friends" },
  ],
} as const

type ToggleKey = keyof typeof TOGGLES
type ToggleValue<K extends ToggleKey> = (typeof TOGGLES)[K][number]["key"]

export type ProtoState = { [K in ToggleKey]: ToggleValue<K> } & {
  /** What the share sheet sits over: the home map or the friends screen. */
  base: "home" | "friends"
}

export type ParamPatch = Partial<Record<keyof ProtoState, string>>

export type ScreenProps = {
  state: ProtoState
  go: (patch: ParamPatch) => void
  /** Stand-in for navigation the prototype doesn't do. */
  stub: (what: string) => void
}

export function PrototypeBar({
  state,
  onChange,
}: {
  state: ProtoState
  onChange: (next: ParamPatch) => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-100">
      {(Object.keys(TOGGLES) as ToggleKey[]).map((k) => (
        <Seg
          key={k}
          options={TOGGLES[k].map((o) => ({ key: o.key, label: o.label }))}
          value={state[k]}
          onChange={(v) =>
            onChange(k === "screen" ? { screen: v, base: "home" } : { [k]: v })
          }
        />
      ))}
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300"
      >
        {resolvedTheme === "dark" ? "dark" : "light"}
      </button>
    </div>
  )
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap rounded-2xl bg-zinc-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-2 py-1 whitespace-nowrap",
            o.key === value ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Page CSS: hide the app's own nav and Next's dev overlay, so only the
 * prototype's look-alike nav shows. Plus the keyframes the screens use. */
export function ProtoStyles() {
  return (
    <style>{`
      nav[aria-label="Primary"], nextjs-portal { display: none !important; }
      .proto-fade { animation: proto-fade 200ms ease-out; }
      @keyframes proto-fade { from { opacity: 0; } to { opacity: 1; } }
      .proto-drawer { animation: proto-drawer 300ms cubic-bezier(0.32, 0.72, 0, 1); }
      @keyframes proto-drawer { from { transform: translateX(-100%); } to { transform: none; } }
      .proto-up { animation: proto-up 320ms cubic-bezier(0.32, 0.72, 0, 1); }
      @keyframes proto-up { from { transform: translateY(100%); } to { transform: none; } }
      @media (prefers-reduced-motion: reduce) {
        .proto-fade, .proto-drawer, .proto-up { animation: none; }
      }
    `}</style>
  )
}

// ---- Shared bits -----------------------------------------------------------

export function MeAvatar({
  className,
  fallbackClassName,
  short = false,
}: {
  className?: string
  fallbackClassName?: string
  /** One initial, for the small header button. */
  short?: boolean
}) {
  const initials = initialsOf(ME.displayName)
  return (
    <Avatar className={className}>
      <AvatarFallback
        className={cn(
          "bg-accent/10 font-medium text-accent-ink",
          fallbackClassName
        )}
      >
        {short ? initials.slice(0, 1) : initials}
      </AvatarFallback>
    </Avatar>
  )
}

/** The home header's glass chip, as in app/page.tsx. */
export const chip =
  "pointer-events-auto flex h-9 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-md active:scale-95 dark:bg-background/90"

// ---- The share shortcut (top right) ----------------------------------------

/**
 * The three takes on what replaces the cog:
 *   A — a share icon in the same round chip as the menu button;
 *   B — your own avatar with a plus;
 *   C — a labelled "invite" pill, the same shape as the signed-out "sign in".
 * None is peach: the nav's flare button is the screen's one peach CTA.
 */
export function ShareShortcut({
  take,
  onClick,
}: {
  take: ProtoState["btn"]
  onClick: () => void
}) {
  if (take === "A") {
    return (
      <button
        type="button"
        aria-label="invite a friend"
        onClick={onClick}
        className={cn(chip, "w-9")}
      >
        <ShareNetworkIcon className="h-4 w-4" />
      </button>
    )
  }
  if (take === "B") {
    return (
      <button
        type="button"
        aria-label="invite a friend"
        onClick={onClick}
        className={cn(chip, "relative w-9 p-0.5")}
      >
        <MeAvatar className="size-full" fallbackClassName="text-sm" short />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background">
          <PlusIcon className="size-2.5" weight="bold" />
        </span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(chip, "gap-1.5 px-3 text-sm font-medium")}
    >
      <UserPlusIcon className="h-4 w-4" />
      invite
    </button>
  )
}

// ---- Mock home -------------------------------------------------------------

/** A flat stand-in for the map: blocks, a park and the river, no pins. */
export function MockMap() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-muted"
    >
      <div className="absolute top-[18%] -left-10 h-40 w-64 rotate-12 rounded-[40px] bg-flare-open/25" />
      <div className="absolute top-[52%] -right-16 h-48 w-72 -rotate-6 rounded-[48px] bg-flare-open/20" />
      <div className="absolute top-[36%] -left-20 h-6 w-[140%] -rotate-[8deg] bg-flare-invite/20" />
      {[14, 30, 46, 62, 78].map((top) => (
        <div
          key={`h${top}`}
          className="absolute h-1.5 w-full bg-background/70"
          style={{ top: `${top}%` }}
        />
      ))}
      {[22, 48, 74].map((left) => (
        <div
          key={`v${left}`}
          className="absolute h-full w-1.5 bg-background/70"
          style={{ left: `${left}%` }}
        />
      ))}
      <span className="absolute top-[44%] left-[52%] flex size-4 items-center justify-center rounded-full bg-background shadow">
        <span className="size-2.5 rounded-full bg-foreground/70" />
      </span>
    </div>
  )
}

/** The home header row: menu, map/calendar toggle, and the share shortcut
 * (signed in) or "sign in" (signed out). */
export function HomeHeader({
  state,
  onMenu,
  onShare,
  onSignIn,
}: {
  state: ProtoState
  onMenu: () => void
  onShare: () => void
  onSignIn: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-3">
      <button
        type="button"
        aria-label="open menu"
        onClick={onMenu}
        className={cn(chip, "w-9")}
      >
        <ListIcon className="h-4 w-4" />
      </button>

      <div className="pointer-events-auto flex items-center rounded-full border border-border/60 bg-background/70 p-1 shadow-sm backdrop-blur-md">
        <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
          <MapTrifoldIcon className="h-4 w-4" />
          map
        </span>
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground">
          <CalendarBlankIcon className="h-4 w-4" />
          calendar
        </span>
      </div>

      {state.auth === "in" ? (
        <ShareShortcut take={state.btn} onClick={onShare} />
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          className={cn(chip, "px-3 text-sm font-medium")}
        >
          sign in
        </button>
      )}
    </div>
  )
}

/** The map's dock sheet. Signed out, it carries the legal row (#457), which
 * must stay one tap from the map. */
export function MockDock({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="rounded-t-3xl bg-background px-4 pt-2 pb-3 shadow-(--shadow-sheet)">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
      <p className="text-base font-semibold">quiet around here</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {signedIn
          ? "no flares from your friends yet"
          : "light a flare and see who turns up"}
      </p>
      <Tabs defaultValue="all">
        <TabsList className="mt-3 h-8 w-full">
          <TabsTrigger value="live" className="text-xs">
            live
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs">
            soon
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            all
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {!signedIn && <LegalLinks className="mt-1 -mb-2" />}
    </div>
  )
}

/** Look-alike of BottomNav (which needs the app's providers). The centre is
 * the real NavFlareButton. Not labelled "Primary", so the page CSS that hides
 * the real nav leaves it alone. */
export function MockNav({
  active,
  onTab,
}: {
  active: "home" | "circles"
  onTab: (tab: "home" | "circles") => void
}) {
  const item = (
    Icon: Icon,
    label: string,
    tab?: "home" | "circles"
  ): React.ReactNode => {
    const on = tab === active
    return (
      <button
        type="button"
        onClick={() => tab && onTab(tab)}
        className={cn(
          "relative flex min-h-11 max-w-20 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-medium",
          on ? "text-accent" : "text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" weight={on ? "fill" : "regular"} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <div
      aria-label="prototype nav"
      className="relative z-10 flex items-end justify-around border-t border-border bg-background px-2 pt-2 pb-2"
    >
      {item(HouseIcon, "home", "home")}
      {item(BellIcon, "feed")}
      <NavFlareButton onClick={() => {}} />
      {item(UsersIcon, "circles", "circles")}
      {item(FireIcon, "my flares")}
    </div>
  )
}

/** The home screen: map, header and dock, with the nav underneath. */
export function MockHome({
  state,
  go,
  stub,
}: ScreenProps & { children?: React.ReactNode }) {
  const signedIn = state.auth === "in"
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <MockMap />
        <HomeHeader
          state={state}
          onMenu={() => go({ screen: "menu" })}
          onShare={() => go({ screen: "share", base: "home" })}
          onSignIn={() => stub("sign in")}
        />
        <div className="absolute inset-x-0 bottom-0 z-20">
          <MockDock signedIn={signedIn} />
        </div>
      </div>
      <MockNav
        active="home"
        onTab={(tab) =>
          tab === "circles" &&
          (signedIn
            ? go({ screen: "friends" })
            : stub("circles needs an account"))
        }
      />
    </div>
  )
}
