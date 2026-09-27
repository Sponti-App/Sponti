"use client"

// PROTOTYPE (#162) — Variant C: "live feed".
// Idea: a flare is a small, short-lived group conversation. A pinned compact
// header carries what/when/where; below it, time is the spine — for the host
// an arrival board ("who turns up when"), for a guest "your plan", then one
// chronological feed of joins and updates (#140). The bottom bar is the
// composer once you're in, the join bar before.

import {
  ArrowLeft,
  Check,
  Lock,
  MapPin,
  MoreHorizontal,
  Navigation,
  Pencil,
  Send,
  UserPlus,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EventAvatarStack } from "@/components/event-avatar-stack"
import { cn } from "@/lib/utils"
import {
  ETA_OPTIONS,
  ago,
  arrivalShort,
  byArrival,
  clock,
  dayLabel,
  etaLabel,
  goingCount,
  goingGuests,
  isLive,
  startsIn,
  statusLine,
  type MockFlare,
} from "./_mock"
import {
  CategoryTile,
  PersonAvatar,
  PlaceholderTag,
  type VariantProps,
} from "./_shared"

export function VariantC(props: VariantProps) {
  const { flare, viewer, now, onStub } = props
  const live = isLive(flare, now)
  const isHost = viewer === "host"
  const going = goingGuests(flare)

  return (
    <div className="pb-40">
      {/* ---- pinned compact header ---- */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-3 pt-2 pb-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="back"
            onClick={() => onStub("back")}
            className="h-10 w-10 shrink-0 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CategoryTile flare={flare} size="sm" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1 truncate text-base font-semibold">
              {flare.title}
              {flare.visibility === "private" && (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
            </h1>
            <p
              className={cn(
                "flex items-center gap-1.5 truncate text-xs",
                live ? "font-medium text-accent" : "text-muted-foreground"
              )}
            >
              {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
              {statusLine(flare, now)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isHost ? "edit flare" : "more"}
            onClick={() => onStub(isHost ? "edit flare" : "more")}
            className="h-10 w-10 shrink-0 rounded-full"
          >
            {isHost ? <Pencil className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ---- facts strip ---- */}
      <section className="flex flex-col gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={() => onStub("directions")}
          className="flex items-center gap-2 text-left text-sm"
        >
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{flare.place.name}</span>
            <span className="text-muted-foreground"> · {flare.place.address}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{flare.place.distance}</span>
        </button>
        <div className="flex items-center gap-2 text-sm">
          <EventAvatarStack people={going} size="xs" count={goingCount(flare)} />
          <span className="text-muted-foreground">
            going · by {isHost ? "you" : flare.host.displayName.split(" ")[0].toLowerCase()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{flare.description}</p>
      </section>

      {/* ---- time spine ---- */}
      <section className="mt-4 border-y border-border/60 px-4 py-3">
        {isHost ? (
          live ? (
            <ArrivalBoard flare={flare} now={now} />
          ) : (
            <HostCountdown flare={flare} now={now} onStub={onStub} />
          )
        ) : viewer === "joined" ? (
          <YourPlan {...props} live={live} />
        ) : (
          <p className="text-sm">
            <span className="font-medium">
              {live ? "happening now" : `${dayLabel(flare.startAt, now)} at ${clock(flare.startAt)}`}
            </span>
            <span className="text-muted-foreground">
              {live ? ` · until ${clock(flare.endAt)}` : ` · ${startsIn(flare, now)}`}
            </span>
          </p>
        )}
      </section>

      {/* ---- feed ---- */}
      <section className="px-4 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">activity</p>
          <PlaceholderTag>#140 thread</PlaceholderTag>
        </div>
        <ol className="flex flex-col gap-3">
          {flare.updates.map((u) =>
            u.kind === "activity" ? (
              <li key={u.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <PersonAvatar person={u.author} className="size-5" />
                <span className="flex-1">
                  <span className="font-medium text-foreground">
                    {u.author.displayName.split(" ")[0].toLowerCase()}
                  </span>{" "}
                  {u.text}
                </span>
                <span>{ago(u.at, now)}</span>
              </li>
            ) : viewer === "invited" ? null : (
              <li key={u.id} className="flex gap-2.5">
                <PersonAvatar person={u.author} className="size-7" />
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-border/60 bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {u.author.id === flare.host.id
                        ? `${u.author.displayName.split(" ")[0].toLowerCase()} · host`
                        : u.author.displayName.split(" ")[0].toLowerCase()}
                    </span>{" "}
                    · {ago(u.at, now)}
                  </p>
                  <p className="text-sm">{u.text}</p>
                </div>
              </li>
            )
          )}
          {viewer === "invited" && (
            <li className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              {(() => {
                const n = flare.updates.filter((u) => u.kind === "message").length
                return `${n} ${n === 1 ? "update" : "updates"} from the group · join to read ${n === 1 ? "it" : "them"}`
              })()}
            </li>
          )}
        </ol>
      </section>

      <BottomBarC {...props} live={live} />
    </div>
  )
}

function ArrivalBoard({ flare, now }: { flare: MockFlare; now: number }) {
  const going = byArrival(goingGuests(flare))
  const nextId = going.find(
    (g) => g.willArriveAt && arrivalShort(g.willArriveAt, now) !== "there"
  )?.id
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        arrivals · until {clock(flare.endAt)}
      </p>
      <ol className="relative ml-2 border-l border-border pl-4">
        {going.map((g) => {
          const there = g.willArriveAt && arrivalShort(g.willArriveAt, now) === "there"
          return (
            <li key={g.id} className="relative flex items-center gap-2.5 py-1.5">
              <span
                className={cn(
                  "absolute -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-background",
                  there ? "bg-muted-foreground" : g.id === nextId ? "bg-accent" : "bg-border"
                )}
              />
              <PersonAvatar person={g} className="size-7" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {g.displayName.toLowerCase()}
                {g.plusOne && <span className="text-muted-foreground"> +1</span>}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  g.id === nextId ? "font-medium text-accent" : "text-muted-foreground"
                )}
              >
                {g.willArriveAt
                  ? there
                    ? "there"
                    : `${arrivalShort(g.willArriveAt, now)} · ${clock(g.willArriveAt)}`
                  : "no eta"}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        {`${flare.guests.filter((g) => g.rsvp === "invited").length} invited, no answer · ${
          flare.guests.filter((g) => g.rsvp === "declined").length
        } can't make it`}
      </p>
    </div>
  )
}

function HostCountdown({
  flare,
  now,
  onStub,
}: {
  flare: MockFlare
  now: number
  onStub: (what: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {dayLabel(flare.startAt, now)} · {clock(flare.startAt)}–{clock(flare.endAt)}
        </p>
        <p className="text-xs text-muted-foreground">
          {`${startsIn(flare, now)} · ${flare.guests.filter((g) => g.rsvp === "invited").length} invited, no answer yet`}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => onStub("invite more")}
      >
        <UserPlus className="h-3.5 w-3.5" /> invite
      </Button>
    </div>
  )
}

function YourPlan({
  flare,
  now,
  myEta,
  onEtaChange,
  onLeave,
  onStub,
  live,
}: VariantProps & { live: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center gap-3 border-l-[3px] border-l-accent pl-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-medium">
            <Check className="h-4 w-4 text-primary" />
            {live ? `you're arriving in ${etaLabel(myEta)}` : `you're going · ${startsIn(flare, now)}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {live ? (
              <button type="button" onClick={() => setOpen((v) => !v)}>
                {flare.host.displayName.split(" ")[0].toLowerCase()} can see this ·{" "}
                <span className="font-medium text-primary">change</span>
              </button>
            ) : (
              <button type="button" onClick={() => onStub("add to calendar")}>
                <span className="font-medium text-primary">add to calendar</span>
              </button>
            )}
            {" · "}
            <button type="button" onClick={onLeave}>
              can&apos;t make it
            </button>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => onStub("directions")}
        >
          <Navigation className="h-3.5 w-3.5" /> {flare.place.travel.replace(" walk", "")}
        </Button>
      </div>
      {open && (
        <div className="mt-3 flex gap-1.5">
          {ETA_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onEtaChange(m)
                setOpen(false)
              }}
              className={cn(
                "h-8 flex-1 rounded-full border text-xs",
                m === myEta
                  ? "border-primary bg-card font-medium text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              {etaLabel(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BottomBarC({
  flare,
  viewer,
  myEta,
  plusOne,
  onEtaChange,
  onPlusOneChange,
  onJoin,
  onStub,
  live,
}: VariantProps & { live: boolean }) {
  if (viewer === "invited") {
    return (
      <div className="fixed inset-x-0 bottom-(--nav-h) z-30 flex flex-col gap-2 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        {live && (
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 pr-1 text-xs text-muted-foreground">there in</span>
            {ETA_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onEtaChange(m)}
                className={cn(
                  "h-8 flex-1 rounded-full border text-xs",
                  m === myEta
                    ? "border-primary bg-card font-medium text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                {etaLabel(m)}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {flare.allowPlusOne && (
            <button
              type="button"
              onClick={() => onPlusOneChange(!plusOne)}
              className={cn(
                "h-11 shrink-0 rounded-full border px-4 text-sm",
                plusOne ? "border-primary bg-card font-medium text-primary" : "border-border text-muted-foreground"
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
            {live ? `join · there in ${etaLabel(myEta)}` : "i'm in"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-(--nav-h) z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={() => onStub(viewer === "host" ? "post update to everyone" : "post update")}
        className="flex w-full items-center gap-2 rounded-full bg-muted py-1 pr-1 pl-4 text-left text-sm text-muted-foreground"
      >
        <span className="flex-1">
          {viewer === "host" ? "update everyone..." : "say something..."}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Send className="h-4 w-4" />
        </span>
      </button>
    </div>
  )
}
