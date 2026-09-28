"use client"

// PROTOTYPE (#162) — Variant B: "map + sheet".
// Idea: the page is the map's event-detail-sheet, opened all the way. A map
// hero answers "where / how far" first; the content sits on a rounded sheet
// with the same header, host note and join flow as the map sheet (#137
// consistency), then segmented tabs for guests and updates.

import {
  ArrowLeft,
  Check,
  Flame,
  Navigation,
  Pencil,
  Send,
  Share2,
  UserPlus,
  X,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatArrivalStatus } from "@/lib/api/events"
import { cn } from "@/lib/utils"
import {
  ETA_OPTIONS,
  ago,
  arrivalShort,
  byArrival,
  categoryOf,
  clock,
  dayLabel,
  etaLabel,
  goingCount,
  goingGuests,
  isLive,
  startsIn,
  statusLine,
  tintFor,
  type MockFlare,
} from "./_mock"
import {
  CategoryTile,
  PersonAvatar,
  PlaceholderTag,
  type VariantProps,
} from "./_shared"

const TAB_TRIGGER =
  "text-sm data-active:bg-card data-active:text-primary dark:data-active:bg-card dark:data-active:text-primary"

export function VariantB(props: VariantProps) {
  const { flare, viewer, now, onStub } = props
  const live = isLive(flare, now)
  const isHost = viewer === "host"
  const going = goingGuests(flare)

  return (
    <div className="pb-24">
      {/* ---- map hero ---- */}
      <div className="relative h-60 overflow-hidden bg-muted">
        <MapArt flare={flare} showRoute={viewer === "joined" && live} />
        <div className="absolute inset-x-0 top-0 flex justify-between px-4 pt-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="back"
            onClick={() => onStub("back")}
            className="h-10 w-10 rounded-full bg-background/90"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={isHost ? "edit flare" : "share"}
            onClick={() => onStub(isHost ? "edit flare" : "share")}
            className="h-10 w-10 rounded-full bg-background/90"
          >
            {isHost ? <Pencil className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => onStub("open in maps")}
          className="absolute right-4 bottom-9 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm"
        >
          <span className="font-medium">{flare.place.name}</span>
          <span className="text-muted-foreground"> · {flare.place.distance} · {flare.place.travel}</span>
        </button>
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
              {live ? statusLine(flare, now) : startsIn(flare, now)}
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

        {/* when | where split — no nested cards, one hairline divider */}
        <div className="mt-4 grid grid-cols-2 divide-x divide-border/60 border-y border-border/60 py-3">
          <div className="pr-3">
            <p className="text-xs text-muted-foreground">when</p>
            <p className="text-sm font-medium">
              {live ? "now" : dayLabel(flare.startAt, now)} · {clock(flare.startAt)}
            </p>
            <p className="text-xs text-muted-foreground">until {clock(flare.endAt)}</p>
          </div>
          <div className="pl-3">
            <p className="text-xs text-muted-foreground">where</p>
            <p className="truncate text-sm font-medium">{flare.place.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {flare.place.address}
            </p>
          </div>
        </div>

        {/* host note, as on the map sheet */}
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

        <div className="mt-4">
          <ActionsB {...props} live={live} />
        </div>

        <Tabs defaultValue="guests" className="mt-6">
          <TabsList className="h-9 w-full">
            <TabsTrigger value="guests" className={TAB_TRIGGER}>
              {goingCount(flare)} going
            </TabsTrigger>
            <TabsTrigger value="updates" className={TAB_TRIGGER}>
              updates · {flare.updates.filter((u) => u.kind === "message").length}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="guests" className="pt-2">
            {isHost ? (
              <HostArrivals flare={flare} now={now} live={live} onStub={onStub} />
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
            {viewer === "invited" ? (
              <p className="text-xs text-muted-foreground">join to see updates.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {flare.updates
                  .filter((u) => u.kind === "message")
                  .map((u) => (
                    <div key={u.id} className="flex gap-2.5">
                      <PersonAvatar person={u.author} className="size-7" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {u.author.displayName.split(" ")[0].toLowerCase()}
                          </span>{" "}
                          · {ago(u.at, now)}
                        </p>
                        <p className="text-sm">{u.text}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ActionsB({
  flare,
  viewer,
  now,
  myEta,
  plusOne,
  onEtaChange,
  onPlusOneChange,
  onJoin,
  onLeave,
  onStub,
  live,
}: VariantProps & { live: boolean }) {
  const [etaOpen, setEtaOpen] = useState(false)
  const peach = "h-12 w-full rounded-full bg-accent text-base text-accent-foreground hover:bg-accent/90"

  if (viewer === "host") {
    return (
      <div className="flex gap-2">
        <Button className={cn(peach, "flex-1")} onClick={() => onStub("post update")}>
          <Send className="h-4 w-4" /> post an update
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-full px-4"
          onClick={() => onStub("invite more")}
          aria-label="invite more"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (viewer === "invited") {
    return (
      <div className="flex flex-col gap-2">
        {live && (
          <>
            <p className="text-xs text-muted-foreground">let host know</p>
            <div className="flex gap-2">
              {ETA_OPTIONS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant="outline"
                  onClick={() => onEtaChange(m)}
                  className={cn(
                    "flex-1 rounded-full",
                    m === myEta && "border-primary bg-card text-primary"
                  )}
                >
                  {etaLabel(m)}
                </Button>
              ))}
            </div>
          </>
        )}
        {flare.allowPlusOne && (
          <label className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={plusOne}
              onChange={(e) => onPlusOneChange(e.target.checked)}
              className="h-4 w-4 accent-(--primary)"
            />
            bringing a +1
          </label>
        )}
        <Button className={peach} onClick={onJoin}>
          <Check className="h-4 w-4" />
          {live ? `on the way · ${etaLabel(myEta)}` : `i'm in · ${dayLabel(flare.startAt, now)} ${clock(flare.startAt)}`}
        </Button>
        <button
          type="button"
          onClick={() => onStub("can't make it")}
          className="py-1 text-xs text-muted-foreground"
        >
          can&apos;t make it
        </button>
      </div>
    )
  }

  // joined
  return (
    <div className="flex flex-col gap-2">
      {live ? (
        <>
          <Button className={peach} onClick={() => onStub("directions")}>
            <Navigation className="h-4 w-4" /> see route · {flare.place.travel}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setEtaOpen((v) => !v)}
              className="text-muted-foreground"
            >
              you said {etaLabel(myEta)} ·{" "}
              <span className="font-medium text-primary">change</span>
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="inline-flex items-center gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" /> can&apos;t make it
            </button>
          </div>
          {etaOpen && (
            <div className="flex gap-2">
              {ETA_OPTIONS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onEtaChange(m)
                    setEtaOpen(false)
                  }}
                  className={cn(
                    "flex-1 rounded-full",
                    m === myEta && "border-primary bg-card text-primary"
                  )}
                >
                  {etaLabel(m)}
                </Button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex gap-2">
          <Button className={cn(peach, "flex-1")} onClick={() => onStub("add to calendar")}>
            add to calendar
          </Button>
          <Button variant="outline" className="h-12 rounded-full px-4" onClick={onLeave}>
            leave
          </Button>
        </div>
      )}
    </div>
  )
}

export function HostArrivals({
  flare,
  now,
  live,
  onStub,
}: {
  flare: MockFlare
  now: number
  live: boolean
  onStub: (what: string) => void
}) {
  const going = byArrival(goingGuests(flare))
  const invited = flare.guests.filter((g) => g.rsvp !== "going")
  return (
    <div>
      <ul>
        {going.map((g) => (
          <li key={g.id} className="flex items-center gap-2.5 py-2">
            <PersonAvatar person={g} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {g.displayName.toLowerCase()}
                {g.plusOne && <span className="text-muted-foreground"> +1</span>}
              </p>
              {live && g.willArriveAt && (
                <p className="truncate text-xs text-muted-foreground">
                  {formatArrivalStatus(g.willArriveAt, now)}
                </p>
              )}
            </div>
            {live && g.willArriveAt ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                  arrivalShort(g.willArriveAt, now) === "there"
                    ? "bg-accent/15 text-accent"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {arrivalShort(g.willArriveAt, now)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">going</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
        {invited.map((g) => (
          <div key={g.id} className="flex items-center gap-2.5 py-1 opacity-60">
            <PersonAvatar person={g} className="size-6" />
            <span className="flex-1 text-sm">{g.displayName.toLowerCase()}</span>
            <span className="text-xs text-muted-foreground">
              {g.rsvp === "declined" ? "can't make it" : "invited"}
            </span>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onStub("manage guests")}
          className="mt-1 self-start text-xs font-medium text-primary"
        >
          manage guests
        </button>
      </div>
    </div>
  )
}

/** Stylised map stand-in (no Maps key needed). Streets, a park, the pin. */
export function MapArt({ flare, showRoute }: { flare: MockFlare; showRoute: boolean }) {
  const tint = tintFor(flare)
  const { icon: Icon } = categoryOf(flare)
  return (
    <div className="absolute inset-0">
      <svg
        viewBox="0 0 375 240"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full text-border"
        aria-hidden
      >
        <rect x="230" y="20" width="110" height="70" rx="8" className="fill-current opacity-40" />
        <g stroke="currentColor" strokeWidth="10" fill="none" className="text-background">
          <path d="M-10 70 L400 40" />
          <path d="M-10 170 L400 150" />
          <path d="M90 -10 L120 260" />
          <path d="M250 -10 L220 260" />
          <path d="M-10 250 L190 110 L400 100" strokeWidth="6" />
        </g>
        {showRoute && (
          <path
            d="M70 170 L140 150 L190 110"
            stroke="var(--primary)"
            strokeWidth="4"
            strokeDasharray="2 8"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {showRoute && <circle cx="70" cy="170" r="7" fill="oklch(0.6 0.15 250)" stroke="white" strokeWidth="3" />}
      </svg>
      <div
        className="absolute flex h-11 w-11 items-center justify-center rounded-full border-4 border-background shadow-md"
        style={{ left: "calc(50% - 22px + 2px)", top: 76, backgroundColor: tint.fg, color: "white" }}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )
}
