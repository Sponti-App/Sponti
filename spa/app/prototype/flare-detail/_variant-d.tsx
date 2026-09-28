"use client"

// PROTOTYPE (#162) — Variant D: B + C, per the #162 decisions.
// Round 1 (2026-09-27):
// - B is the base: map on top, sheet below, B's section order.
// - Icons instead of "when" / "where" labels.
// - One pinned main button: invited → "join"; joined + host → "share an
//   update", which turns the bar into C's composer. Edit / manage live in
//   the header.
// - Host keeps C's arrival board.
// - Updates: host and joined guests only; invited sees a locked line.
// - ETA option only when live or starting within 1h.
// - Host updates render as announcements, guest updates plain.
// Round 2 (Patrick's review):
// - ETAs are host-only (#90). Guests never see other guests' ETAs.
// - Joined guest's own row: "you're arriving in …" with real change /
//   cancel buttons (cancel clears the ETA); "can't make it" stays separate.
// - Before the start ("within 1h"): on time / running late, not minutes.
// - Drawn route only within 2 km, and never for the host (open choice);
//   "open in maps" always available. The place line opens Google Maps.
// - +1s: never next to a name for guests; spots-left counts +1s as heads.
// - Compact one-row join bar.

import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Flame,
  Lock,
  MapPin,
  Megaphone,
  Navigation,
  Pencil,
  Send,
  Share2,
  Users,
  X,
} from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ETA_OPTIONS,
  ago,
  categoryOf,
  clock,
  dayLabel,
  etaAvailable,
  etaLabel,
  goingCount,
  goingGuests,
  isLive,
  mapsUrl,
  spotsLeft,
  startsIn,
  statusLine,
  type Arrival,
  type MockFlare,
} from "./_mock"
import { CategoryTile, PersonAvatar, PlaceholderTag, type VariantProps } from "./_shared"
import { HostArrivals, MapArt } from "./_variant-b"
import { ArrivalBoard } from "./_variant-c"

const TAB_TRIGGER =
  "text-sm data-active:bg-card data-active:text-primary dark:data-active:bg-card dark:data-active:text-primary"

const ARRIVAL_LABEL: Record<Arrival, string> = {
  "on-time": "on time",
  late: "running late",
}

export function VariantD(props: VariantProps) {
  const { flare, viewer, now, onStub } = props
  const live = isLive(flare, now)
  const withEta = etaAvailable(flare, now)
  const isHost = viewer === "host"
  const canSeeThread = viewer !== "invited"
  const near = flare.place.near
  const going = goingGuests(flare)
  const messages = flare.updates.filter((u) => u.kind === "message")
  const hostFirst = flare.host.displayName.split(" ")[0].toLowerCase()
  const maps = mapsUrl(flare)

  const [tab, setTab] = useState("guests")
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const openComposer = () => {
    setTab("updates")
    setComposing(true)
    // Focus after the bar re-renders as an input.
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Guests never see +1s next to a name, so their going count is people;
  // spots left always counts heads (+1s included).
  const countLabel = isHost ? `${goingCount(flare)} going` : `${going.length} going`
  const spots = spotsLeft(flare)

  return (
    <div className={viewer === "invited" ? "pb-20" : "pb-24"}>
      {/* ---- map hero (B) ---- */}
      <div className="relative h-56 overflow-hidden bg-muted">
        {/* Drawn walking route: within 2 km only, never for the host. */}
        <MapArt flare={flare} showRoute={near && !isHost} />
        <div className="absolute inset-x-0 top-0 flex justify-between px-4 pt-2">
          <HeaderButton label="back" onClick={() => onStub("back")}>
            <ArrowLeft className="h-4 w-4" />
          </HeaderButton>
          <div className="flex gap-2">
            {isHost ? (
              <>
                <HeaderButton label="manage guests" onClick={() => onStub("manage guests")}>
                  <Users className="h-4 w-4" />
                </HeaderButton>
                <HeaderButton label="edit flare" onClick={() => onStub("edit flare")}>
                  <Pencil className="h-4 w-4" />
                </HeaderButton>
              </>
            ) : (
              <HeaderButton label="share" onClick={() => onStub("share")}>
                <Share2 className="h-4 w-4" />
              </HeaderButton>
            )}
          </div>
        </div>
        {/* "open in maps" — always available, near or far. */}
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="absolute right-4 bottom-9 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm"
        >
          <Navigation className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">open in maps</span>
          <span className="text-muted-foreground">
            · {near && !isHost ? flare.place.travel : `${flare.place.distance} away`}
          </span>
        </a>
      </div>

      {/* ---- sheet ---- */}
      <div className="relative -mt-6 rounded-t-3xl bg-background px-4 pt-3 shadow-(--shadow-sheet)">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" />

        <div className="flex items-start gap-3">
          <CategoryTile flare={flare} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-snug font-semibold">{flare.title}</h1>
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1 text-sm",
                live ? "text-accent" : "text-muted-foreground"
              )}
            >
              {live && <Flame className="h-4 w-4" />}
              {live ? statusLine(flare, now) : `starts ${startsIn(flare, now)}`}
            </p>
          </div>
          {viewer === "joined" && (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent">
              <Check className="h-3 w-3" /> going
            </span>
          )}
          {isHost && (
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              hosting
            </span>
          )}
        </div>

        {/* when | where — icons, no labels; the place opens Google Maps */}
        <div className="mt-4 grid grid-cols-2 divide-x divide-border/60 border-y border-border/60 py-3">
          <div className="flex gap-2 pr-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="when" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {live ? "now" : dayLabel(flare.startAt, now)} · {clock(flare.startAt)}
              </p>
              <p className="text-xs text-muted-foreground">until {clock(flare.endAt)}</p>
            </div>
          </div>
          <a
            href={maps}
            target="_blank"
            rel="noreferrer"
            aria-label={`open ${flare.place.name} in google maps`}
            className="flex gap-2 pl-3 active:opacity-70"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-medium underline decoration-border underline-offset-2">
                {flare.place.name}
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {flare.place.distance} · {flare.place.address}
              </p>
            </div>
          </a>
        </div>

        {/* host note (B) */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-muted p-3">
          <PersonAvatar person={flare.host} className="size-7" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {isHost ? "hosted by you" : `hosted by ${flare.host.displayName.toLowerCase()}`}
              <span className="font-normal text-muted-foreground">
                {" "}· {categoryOf(flare).label}
                {flare.visibility === "private" && " · private"}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{flare.description}</p>
          </div>
        </div>

        {/* your plan — joined guest, only while an ETA applies */}
        {viewer === "joined" && withEta && <YourPlan {...props} live={live} hostFirst={hostFirst} />}

        <Tabs value={tab} onValueChange={setTab} className="mt-5">
          <TabsList className="h-9 w-full">
            <TabsTrigger value="guests" className={TAB_TRIGGER}>
              {countLabel}
            </TabsTrigger>
            <TabsTrigger value="updates" className={TAB_TRIGGER}>
              {!canSeeThread && <Lock className="h-3 w-3" />}
              updates · {messages.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guests" className="pt-2">
            <p className="mb-2 text-xs text-muted-foreground">
              {`about ${spots} ${spots === 1 ? "spot" : "spots"} left · ${flare.guestLimit} max`}
            </p>
            {isHost ? (
              live ? (
                <ArrivalBoard flare={flare} now={now} />
              ) : withEta ? (
                <HostSoonBoard flare={flare} />
              ) : (
                <HostArrivals flare={flare} now={now} live={false} onStub={onStub} />
              )
            ) : (
              // Guests: names only. No ETAs, no +1s.
              <div className="grid grid-cols-4 gap-y-3">
                {going.map((g) => (
                  <div key={g.id} className="flex flex-col items-center gap-1">
                    <PersonAvatar person={g} className="size-11" />
                    <span className="max-w-full truncate text-xs">
                      {g.isYou ? "you" : g.displayName.split(" ")[0].toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="updates" className="pt-2">
            <div className="mb-2">
              <PlaceholderTag>#140 thread</PlaceholderTag>
            </div>
            {!canSeeThread ? (
              <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                {`${messages.length} ${messages.length === 1 ? "update" : "updates"} · join to see`}
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {messages.map((u) =>
                  u.author.id === flare.host.id ? (
                    <li
                      key={u.id}
                      className="rounded-xl border-l-[3px] border-l-accent bg-card px-3 py-2"
                    >
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Megaphone className="h-3.5 w-3.5 text-accent" />
                        <span className="font-semibold text-foreground">
                          {isHost ? "your announcement" : `announcement from ${hostFirst}`}
                        </span>
                        · {ago(u.at, now)}
                      </p>
                      <p className="mt-0.5 text-sm">{u.text}</p>
                    </li>
                  ) : (
                    <li key={u.id} className="flex gap-2.5">
                      <PersonAvatar person={u.author} className="size-7" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {u.author.displayName.split(" ")[0].toLowerCase()}
                          </span>{" "}
                          · {ago(u.at, now)}
                        </p>
                        <p className="text-sm">{u.text}</p>
                      </div>
                    </li>
                  )
                )}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PinnedBarD
        {...props}
        live={live}
        withEta={withEta}
        composing={composing}
        inputRef={inputRef}
        onCompose={openComposer}
        onCloseComposer={() => setComposing(false)}
      />
    </div>
  )
}

/** Host, before the start: who said on time / running late. */
function HostSoonBoard({ flare }: { flare: MockFlare }) {
  const order = { "on-time": 0, late: 1 } as const
  const going = [...goingGuests(flare)].sort(
    (a, b) => (a.arrival ? order[a.arrival] : 2) - (b.arrival ? order[b.arrival] : 2)
  )
  return (
    <ul>
      {going.map((g) => (
        <li key={g.id} className="flex items-center gap-2.5 py-1.5">
          <PersonAvatar person={g} className="size-7" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {g.displayName.toLowerCase()}
            {g.plusOne && <span className="text-muted-foreground"> +1</span>}
          </span>
          <span
            className={cn(
              "text-xs",
              g.arrival === "late" ? "font-medium text-accent" : "text-muted-foreground"
            )}
          >
            {g.arrival ? ARRIVAL_LABEL[g.arrival] : "no answer"}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Joined guest's own plan: real change / cancel buttons. */
function YourPlan({
  myEta,
  onEtaChange,
  arrival = "on-time",
  onArrivalChange,
  etaShared = true,
  onEtaSharedChange,
  onLeave,
  live,
  hostFirst,
}: VariantProps & { live: boolean; hostFirst: string }) {
  const [open, setOpen] = useState(false)
  const summary = !etaShared
    ? "no arrival time shared"
    : live
      ? `you're arriving in ${etaLabel(myEta)}`
      : arrival === "on-time"
        ? "you'll be on time"
        : "you're running late"

  return (
    <div className="mt-4 border-l-[3px] border-l-accent pl-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{summary}</p>
          <p className="text-xs text-muted-foreground">
            {etaShared ? `only ${hostFirst} sees this` : `${hostFirst} won't see an eta`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setOpen((v) => !v)}
        >
          {etaShared ? "change" : "add"}
        </Button>
        {etaShared && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground"
            onClick={() => {
              onEtaSharedChange?.(false)
              setOpen(false)
            }}
          >
            cancel
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2 flex gap-1.5">
          {live
            ? ETA_OPTIONS.map((m) => (
                <Chip
                  key={m}
                  selected={etaShared && m === myEta}
                  onClick={() => {
                    onEtaChange(m)
                    setOpen(false)
                  }}
                >
                  {etaLabel(m)}
                </Chip>
              ))
            : (["on-time", "late"] as const).map((a) => (
                <Chip
                  key={a}
                  selected={etaShared && a === arrival}
                  onClick={() => {
                    onArrivalChange?.(a)
                    setOpen(false)
                  }}
                >
                  {ARRIVAL_LABEL[a]}
                </Chip>
              ))}
        </div>
      )}
      {/* Leaving is a separate, secondary action. */}
      <button
        type="button"
        onClick={onLeave}
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <X className="h-3 w-3" /> can&apos;t make it
      </button>
    </div>
  )
}

function PinnedBarD({
  flare,
  viewer,
  myEta,
  plusOne,
  arrival = "on-time",
  onArrivalChange,
  onEtaChange,
  onPlusOneChange,
  onJoin,
  onLeave,
  onStub,
  live,
  withEta,
  composing,
  inputRef,
  onCompose,
  onCloseComposer,
}: VariantProps & {
  live: boolean
  withEta: boolean
  composing: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onCompose: () => void
  onCloseComposer: () => void
}) {
  const [draft, setDraft] = useState("")
  const bar =
    "fixed inset-x-0 bottom-(--nav-h) z-30 border-t border-border/60 bg-background/95 backdrop-blur"

  if (viewer === "invited") {
    // Compact: one caption line + one row (arrival chips · +1 · join).
    return (
      <div className={cn(bar, "px-4 pt-1.5 pb-2")}>
        {withEta && (
          <p className="mb-1 text-xs leading-none text-muted-foreground">
            {live ? "when will you get there?" : "will you make the start?"}
          </p>
        )}
        <div className="flex items-center gap-1">
          {withEta &&
            (live
              ? ETA_OPTIONS.map((m) => (
                  <Chip key={m} compact selected={m === myEta} onClick={() => onEtaChange(m)}>
                    {m >= 60 ? "1h" : `${m}m`}
                  </Chip>
                ))
              : (["on-time", "late"] as const).map((a) => (
                  <Chip key={a} compact selected={a === arrival} onClick={() => onArrivalChange?.(a)}>
                    {a === "on-time" ? "on time" : "late"}
                  </Chip>
                )))}
          {flare.allowPlusOne && (
            <button
              type="button"
              onClick={() => onPlusOneChange(!plusOne)}
              aria-pressed={plusOne}
              aria-label="bringing a +1"
              className={cn(
                "h-10 w-10 shrink-0 rounded-full border text-xs",
                plusOne
                  ? "border-primary bg-card font-medium text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              +1
            </button>
          )}
          <Button
            className="h-10 min-w-0 flex-1 rounded-full bg-accent px-3 text-accent-foreground hover:bg-accent/90"
            onClick={onJoin}
          >
            <Check className="h-4 w-4" /> join
          </Button>
          {!withEta && (
            <Button
              variant="ghost"
              className="h-10 shrink-0 rounded-full px-3 text-xs text-muted-foreground"
              onClick={() => onStub("can't make it")}
            >
              can&apos;t make it
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (composing) {
    return (
      <form
        className={cn(bar, "px-4 py-2")}
        onSubmit={(e) => {
          e.preventDefault()
          onStub(viewer === "host" ? "post announcement" : "post update")
          setDraft("")
          onCloseComposer()
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-muted py-1 pr-1 pl-4">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (!draft.trim()) onCloseComposer()
            }}
            placeholder={viewer === "host" ? "announce to everyone..." : "say something..."}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
          <button
            type="submit"
            aria-label="send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className={cn(bar, "flex items-center gap-2 px-4 py-2")}>
      <Button
        className="h-11 flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={onCompose}
      >
        <Send className="h-4 w-4" /> share an update
      </Button>
      {viewer === "joined" && !withEta && (
        <Button
          variant="ghost"
          className="h-11 shrink-0 rounded-full px-3 text-xs text-muted-foreground"
          onClick={onLeave}
        >
          can&apos;t make it
        </Button>
      )}
    </div>
  )
}

function Chip({
  selected,
  compact = false,
  onClick,
  children,
}: {
  selected: boolean
  compact?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border text-xs whitespace-nowrap",
        compact ? "h-10 shrink-0 px-2.5" : "h-8 flex-1",
        selected
          ? "border-primary bg-card font-medium text-primary"
          : "border-border text-muted-foreground"
      )}
    >
      {children}
    </button>
  )
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className="h-10 w-10 rounded-full bg-background/90"
    >
      {children}
    </Button>
  )
}
