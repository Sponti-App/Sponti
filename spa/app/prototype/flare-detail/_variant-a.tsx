"use client"

// PROTOTYPE (#162) — Variant A: "compact header".
// Idea: #139 taken to the whole page. A short header answers what/when/where/
// who in one glance via tappable key-fact chips; the rest is a calm, scannable
// document of zones. The one peach action lives in a sticky bar above the nav.

import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  MapPinIcon,
  DotsThreeIcon,
  NavigationArrowIcon,
  PencilSimpleIcon,
  PaperPlaneRightIcon,
  ShareNetworkIcon,
  UserPlusIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EventAvatarStack } from "@/components/event-avatar-stack"
import { formatArrivalStatus } from "@/lib/api/events"
import { cn } from "@/lib/utils"
import {
  ETA_OPTIONS,
  ago,
  byArrival,
  categoryOf,
  clock,
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

export function VariantA(props: VariantProps) {
  const { flare, viewer, now, onStub } = props
  const live = isLive(flare, now)
  const isHost = viewer === "host"
  const going = goingGuests(flare)
  const cat = categoryOf(flare)

  return (
    <div className="pb-56">
      <header className="flex items-center justify-between px-4 pt-2">
        <RoundButton label="back" onClick={() => onStub("back")}>
          <ArrowLeftIcon className="h-4 w-4" />
        </RoundButton>
        <div className="flex gap-2">
          {isHost ? (
            <RoundButton
              label="edit flare"
              onClick={() => onStub("edit flare")}
            >
              <PencilSimpleIcon className="h-4 w-4" />
            </RoundButton>
          ) : (
            <RoundButton label="share" onClick={() => onStub("share")}>
              <ShareNetworkIcon className="h-4 w-4" />
            </RoundButton>
          )}
          <RoundButton label="more" onClick={() => onStub("more")}>
            <DotsThreeIcon className="h-4 w-4" />
          </RoundButton>
        </div>
      </header>

      {/* ---- header zone: what + key facts ---- */}
      <section className="px-4 pt-4">
        <div className="flex items-start gap-3">
          <CategoryTile flare={flare} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {cat.label}
              {flare.visibility === "private" && (
                <>
                  <span>·</span>
                  <LockIcon className="h-3 w-3" /> private
                </>
              )}
              <PlaceholderTag>#138</PlaceholderTag>
            </p>
            <h1 className="mt-0.5 text-lg leading-snug font-semibold">
              {flare.title}
            </h1>
            <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
              {isHost
                ? "you're hosting"
                : `by ${flare.host.displayName.toLowerCase()}`}
              {viewer === "joined" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
                  <CheckIcon className="h-3 w-3" /> going
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <FactChip icon={ClockIcon} live={live} href="#a-when">
            {statusLine(flare, now)}
          </FactChip>
          <FactChip icon={MapPinIcon} href="#a-where">
            {flare.place.name} · {flare.place.distance}
          </FactChip>
          <a
            href="#a-who"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card pr-3 pl-1.5 text-xs"
          >
            <EventAvatarStack
              people={going}
              size="xs"
              count={goingCount(flare)}
            />
            <span className="text-muted-foreground">going</span>
          </a>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {flare.description}
        </p>
      </section>

      {/* ---- when + where ---- */}
      <section id="a-when" className="mt-6 border-t border-border/60 px-4 pt-4">
        <SectionLabel>when</SectionLabel>
        <p className="text-sm font-medium">
          {live ? "happening now" : statusLine(flare, now)}
        </p>
        <p className="text-xs text-muted-foreground">
          {live
            ? `started ${ago(flare.startAt, now)} ago`
            : `starts ${startsIn(flare, now)}`}{" "}
          · until {clock(flare.endAt)}
        </p>
      </section>

      <section id="a-where" className="mt-4 px-4">
        <SectionLabel>where</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{flare.place.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {flare.place.address} · {flare.place.travel}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => onStub("directions")}
          >
            <NavigationArrowIcon className="h-3.5 w-3.5" />
            directions
          </Button>
        </div>
      </section>

      {/* ---- who ---- */}
      <section id="a-who" className="mt-6 border-t border-border/60 px-4 pt-4">
        <div className="flex items-center justify-between">
          <SectionLabel>
            {goingCount(flare)} going
            {isHost && live && " · sorted by arrival"}
          </SectionLabel>
          {isHost && (
            <button
              type="button"
              onClick={() => onStub("invite more")}
              className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              <UserPlusIcon className="h-3.5 w-3.5" /> invite
            </button>
          )}
        </div>
        <ul>
          {(isHost ? byArrival(going) : going).map((g, i, arr) => (
            <li
              key={g.id}
              className={cn(
                "flex items-center gap-2.5 py-2",
                i < arr.length - 1 && "border-b border-border/60"
              )}
            >
              <PersonAvatar person={g} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {g.isYou ? "you" : g.displayName.toLowerCase()}
                  {g.plusOne && (
                    <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                      +1
                    </span>
                  )}
                </p>
                {g.willArriveAt && (isHost || g.isYou) ? (
                  <p className="truncate text-xs text-accent">
                    {formatArrivalStatus(g.willArriveAt, now)}
                  </p>
                ) : (
                  <p className="truncate text-xs text-muted-foreground">
                    @{g.username}
                  </p>
                )}
              </div>
              <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
            </li>
          ))}
        </ul>
        {isHost && <HostInviteSummary flare={flare} />}
      </section>

      {/* ---- updates (thread placeholder, #140) ---- */}
      <section className="mt-6 border-t border-border/60 px-4 pt-4">
        <div className="mb-2 flex items-center gap-2">
          <SectionLabel className="mb-0">updates</SectionLabel>
          <PlaceholderTag>#140</PlaceholderTag>
        </div>
        {viewer === "invited" ? (
          <p className="text-xs text-muted-foreground">
            join to see updates from{" "}
            {flare.host.displayName.split(" ")[0].toLowerCase()} and the group.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {flare.updates
              .filter((u) => u.kind === "message")
              .map((u) => (
                <div key={u.id} className="flex gap-2.5">
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
                </div>
              ))}
            <button
              type="button"
              onClick={() => onStub("write an update")}
              className="flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-left text-sm text-muted-foreground"
            >
              <span className="flex-1">write an update...</span>
              <PaperPlaneRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      <ActionBarA {...props} live={live} />
    </div>
  )
}

function ActionBarA({
  flare,
  viewer,
  myEta,
  plusOne,
  onEtaChange,
  onPlusOneChange,
  onJoin,
  onLeave,
  onStub,
  live,
}: VariantProps & { live: boolean }) {
  const [changingEta, setChangingEta] = useState(false)
  const hostFirst = flare.host.displayName.split(" ")[0].toLowerCase()

  return (
    <div className="fixed inset-x-0 bottom-(--nav-h) z-30 border-t border-border/60 bg-background/95 px-4 pt-3 pb-3 backdrop-blur">
      {viewer === "host" ? (
        <div className="flex gap-2">
          <Button
            className="h-11 flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => onStub(live ? "post update" : "invite more")}
          >
            {live ? (
              <PaperPlaneRightIcon className="h-4 w-4" />
            ) : (
              <UserPlusIcon className="h-4 w-4" />
            )}
            {live ? "post an update" : "invite more"}
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            onClick={() => onStub("manage")}
          >
            <UsersIcon className="h-4 w-4" /> manage
          </Button>
        </div>
      ) : viewer === "invited" ? (
        <div className="flex flex-col gap-2">
          {live && (
            <>
              <p className="text-xs text-muted-foreground">
                {`let ${hostFirst} know when you'll be there`}
              </p>
              <EtaChips value={myEta} onChange={onEtaChange} />
            </>
          )}
          {flare.allowPlusOne && (
            <PlusOneToggle value={plusOne} onChange={onPlusOneChange} />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-full px-4"
              onClick={() => onStub("can't make it")}
            >
              can&apos;t make it
            </Button>
            <Button
              className="h-11 flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={onJoin}
            >
              <CheckIcon className="h-4 w-4" />
              {live ? `on my way · ${etaLabel(myEta)}` : "i'm in"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {live && changingEta && (
            <EtaChips
              value={myEta}
              onChange={(m) => {
                onEtaChange(m)
                setChangingEta(false)
              }}
            />
          )}
          <div className="flex gap-2">
            {live ? (
              <Button
                variant="outline"
                className="h-11 rounded-full px-4"
                onClick={() => setChangingEta((v) => !v)}
              >
                <ClockIcon className="h-4 w-4" /> eta {etaLabel(myEta)}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-11 rounded-full px-4"
                onClick={onLeave}
              >
                can&apos;t make it
              </Button>
            )}
            <Button
              className="h-11 flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => onStub(live ? "directions" : "add to calendar")}
            >
              {live ? (
                <NavigationArrowIcon className="h-4 w-4" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              {live ? "directions" : "add to calendar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function EtaChips({
  value,
  onChange,
}: {
  value: number
  onChange: (min: number) => void
}) {
  return (
    <div className="flex gap-1.5">
      {ETA_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "h-8 flex-1 rounded-full border text-xs transition-colors",
            m === value
              ? "border-primary bg-card font-medium text-primary"
              : "border-border text-muted-foreground"
          )}
        >
          {etaLabel(m)}
        </button>
      ))}
    </div>
  )
}

export function PlusOneToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-(--primary)"
      />
      bringing a +1
    </label>
  )
}

function HostInviteSummary({ flare }: { flare: MockFlare }) {
  const invited = flare.guests.filter((g) => g.rsvp === "invited").length
  const declined = flare.guests.filter((g) => g.rsvp === "declined").length
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {invited} invited, no answer yet
      {declined > 0 && ` · ${declined} can't make it`}
    </p>
  )
}

function FactChip({
  icon: Icon,
  live,
  href,
  children,
}: {
  icon: Icon
  live?: boolean
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs",
        live && "border-l-[3px] border-l-accent font-medium"
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          live ? "text-accent" : "text-muted-foreground"
        )}
      />
      {children}
    </a>
  )
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "mb-2 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  )
}

function RoundButton({
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
      className="h-10 w-10 rounded-full"
    >
      {children}
    </Button>
  )
}
