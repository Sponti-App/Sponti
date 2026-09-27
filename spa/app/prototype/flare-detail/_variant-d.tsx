"use client"

// PROTOTYPE (#162) — Variant D: B + C, per the #162 decisions (2026-09-27).
// - B is the base: map on top, sheet below, B's section order.
// - Icons instead of "when" / "where" labels.
// - One pinned main button: invited → "join"; joined + host → "share an
//   update", which turns the bar into C's composer. Edit / manage live in
//   the header.
// - Directions is secondary, and the walking route + directions only show
//   when the viewer is within 2 km.
// - Host keeps C's arrival board.
// - Updates + ETAs: host and joined guests only. Invited sees a locked line.
//   +1s: host only.
// - ETA option only when live or starting within 1h.
// - Host updates render as announcements, guest updates plain.

import {
  ArrowLeft,
  Check,
  Clock,
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
  arrivalShort,
  categoryOf,
  clock,
  dayLabel,
  etaAvailable,
  etaLabel,
  goingCount,
  goingGuests,
  isLive,
  startsIn,
  statusLine,
  type MockGuest,
} from "./_mock"
import { CategoryTile, PersonAvatar, PlaceholderTag, type VariantProps } from "./_shared"
import { HostArrivals, MapArt } from "./_variant-b"
import { ArrivalBoard } from "./_variant-c"

const TAB_TRIGGER =
  "text-sm data-active:bg-card data-active:text-primary dark:data-active:bg-card dark:data-active:text-primary"

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

  const [tab, setTab] = useState("guests")
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const openComposer = () => {
    setTab("updates")
    setComposing(true)
    // Focus after the bar re-renders as an input.
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Guests never see +1s, so their count is people, not heads.
  const countLabel = isHost ? `${goingCount(flare)} going` : `${going.length} going`

  return (
    <div className="pb-28">
      {/* ---- map hero (B) — route only when near ---- */}
      <div className="relative h-56 overflow-hidden bg-muted">
        <MapArt flare={flare} showRoute={near} />
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
        {near ? (
          <button
            type="button"
            onClick={() => onStub("directions")}
            className="absolute right-4 bottom-9 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm"
          >
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">directions</span>
            <span className="text-muted-foreground">· {flare.place.travel}</span>
          </button>
        ) : (
          <span className="absolute right-4 bottom-9 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
            {flare.place.distance} away
          </span>
        )}
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

        {/* when | where — icons, no labels */}
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
          <div className="flex gap-2 pl-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="where" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{flare.place.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {flare.place.distance} · {flare.place.address}
              </p>
            </div>
          </div>
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

        {/* your ETA — joined guest, only while ETAs are relevant */}
        {viewer === "joined" && withEta && <YourEta {...props} />}

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
            {isHost ? (
              withEta ? (
                <ArrivalBoard flare={flare} now={now} />
              ) : (
                <HostArrivals flare={flare} now={now} live={false} onStub={onStub} />
              )
            ) : viewer === "joined" && withEta ? (
              <GuestEtaList guests={going} now={now} />
            ) : (
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
              <LockedLine count={messages.length} />
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
        withEta={withEta}
        hostFirst={hostFirst}
        composing={composing}
        inputRef={inputRef}
        onCompose={openComposer}
        onCloseComposer={() => setComposing(false)}
      />
    </div>
  )
}

function LockedLine({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5" />
      {`${count} ${count === 1 ? "update" : "updates"} · join to see`}
    </p>
  )
}

/** Joined guests see ETAs (decision), never +1s. */
function GuestEtaList({ guests, now }: { guests: MockGuest[]; now: number }) {
  const sorted = [...guests].sort((a, b) => {
    const ta = a.willArriveAt ? new Date(a.willArriveAt).getTime() : Infinity
    const tb = b.willArriveAt ? new Date(b.willArriveAt).getTime() : Infinity
    return ta - tb
  })
  return (
    <ul>
      {sorted.map((g) => (
        <li key={g.id} className="flex items-center gap-2.5 py-1.5">
          <PersonAvatar person={g} className="size-7" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {g.isYou ? "you" : g.displayName.toLowerCase()}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {g.willArriveAt ? arrivalShort(g.willArriveAt, now) : "no eta"}
          </span>
        </li>
      ))}
    </ul>
  )
}

function YourEta({
  myEta,
  onEtaChange,
  onLeave,
}: VariantProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 border-l-[3px] border-l-accent pl-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <p>
          <span className="font-medium">{`you're there in ${etaLabel(myEta)}`}</span>
          <span className="text-xs text-muted-foreground">{" · everyone going can see this"}</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-xs font-medium text-primary"
        >
          change
        </button>
      </div>
      {open && (
        <div className="mt-2 flex gap-1.5">
          {ETA_OPTIONS.map((m) => (
            <EtaChip
              key={m}
              min={m}
              selected={m === myEta}
              onClick={() => {
                onEtaChange(m)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onLeave}
        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"
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
  onEtaChange,
  onPlusOneChange,
  onJoin,
  onLeave,
  onStub,
  withEta,
  hostFirst,
  composing,
  inputRef,
  onCompose,
  onCloseComposer,
}: VariantProps & {
  withEta: boolean
  hostFirst: string
  composing: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onCompose: () => void
  onCloseComposer: () => void
}) {
  const [draft, setDraft] = useState("")
  const bar =
    "fixed inset-x-0 bottom-(--nav-h) z-30 flex flex-col gap-2 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur"

  if (viewer === "invited") {
    return (
      <div className={bar}>
        {withEta && (
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 pr-1 text-xs text-muted-foreground">
              {`tell ${hostFirst}`}
            </span>
            {ETA_OPTIONS.map((m) => (
              <EtaChip key={m} min={m} selected={m === myEta} onClick={() => onEtaChange(m)} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {flare.allowPlusOne && (
            <button
              type="button"
              onClick={() => onPlusOneChange(!plusOne)}
              aria-pressed={plusOne}
              className={cn(
                "h-11 shrink-0 rounded-full border px-4 text-sm",
                plusOne
                  ? "border-primary bg-card font-medium text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              +1
            </button>
          )}
          <Button
            className="h-11 flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={onJoin}
          >
            <Check className="h-4 w-4" />
            {withEta ? `join · there in ${etaLabel(myEta)}` : "join"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="can't make it"
            className="h-11 w-11 shrink-0 rounded-full text-muted-foreground"
            onClick={() => onStub("can't make it")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (composing) {
    return (
      <form
        className={bar}
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
    <div className={bar}>
      <Button
        className="h-11 w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={onCompose}
      >
        <Send className="h-4 w-4" /> share an update
      </Button>
      {viewer === "joined" && !withEta && (
        <button
          type="button"
          onClick={onLeave}
          className="text-xs text-muted-foreground"
        >
          can&apos;t make it
        </button>
      )}
    </div>
  )
}

function EtaChip({
  min,
  selected,
  onClick,
}: {
  min: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 flex-1 rounded-full border text-xs",
        selected
          ? "border-primary bg-card font-medium text-primary"
          : "border-border text-muted-foreground"
      )}
    >
      {etaLabel(min)}
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

