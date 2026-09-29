"use client"

// Building blocks of the flare detail layout (#139, layout D from #162),
// shared by the full page (/event/[id]) and the map's detail sheet so the
// same flare reads and acts the same in both places. The rules behind them
// live in lib/flare-detail.ts.

import { Check, Clock, ExternalLink, Flame, MapPin, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EventType } from "@/lib/api/events"
import {
  ARRIVAL_STATUS_CHOICES,
  ETA_CHOICES,
  etaAvailable,
  etaControlKind,
  type FlareTiming,
  type FlareViewer,
} from "@/lib/flare-detail"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"

/**
 * The flare's category icon on a tint. A single brand tint for now; #138
 * gives each category its own.
 */
export function CategoryTile({
  type,
  size = "lg",
}: {
  type: EventType
  size?: "md" | "lg"
}) {
  const match = EVENT_TYPES.find((t) => t.value === type)
  const Icon = match?.icon ?? Flame
  return (
    <div
      role="img"
      aria-label={match?.label ?? "flare"}
      className={cn(
        "flex shrink-0 items-center justify-center bg-accent/15 text-accent",
        size === "lg" ? "h-14 w-14 rounded-2xl" : "h-12 w-12 rounded-xl"
      )}
    >
      <Icon className={size === "lg" ? "h-7 w-7" : "h-6 w-6"} />
    </div>
  )
}

export function FlareHeader({
  type,
  title,
  statusLine,
  timing,
  viewer,
  as: Heading = "h1",
}: {
  type: EventType
  title: string
  statusLine: string
  timing: FlareTiming
  viewer: FlareViewer
  as?: "h1" | "h2"
}) {
  const live = timing === "live"
  const over = timing === "ended" || timing === "cancelled"
  return (
    <div className="flex items-start gap-3">
      <CategoryTile type={type} />
      <div className="min-w-0 flex-1">
        <Heading
          className={cn(
            "text-lg leading-snug font-semibold",
            timing === "cancelled" && "text-muted-foreground line-through"
          )}
        >
          {title.toLowerCase()}
        </Heading>
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 text-sm",
            live ? "text-accent" : "text-muted-foreground"
          )}
        >
          {live && <Flame className="h-4 w-4" />}
          {statusLine}
        </p>
      </div>
      {viewer === "joined" && !over && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent">
          <Check className="h-3 w-3" /> going
        </span>
      )}
      {viewer === "host" && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          hosting
        </span>
      )}
    </div>
  )
}

/** When | where, with icons instead of labels. The place opens Google Maps. */
export function FlareFacts({
  when,
  until,
  placeName,
  placeDetail,
  mapsUrl,
}: {
  when: string
  until: string
  placeName: string
  /** "1.2 mi · 47 chandos pl" */
  placeDetail?: string | null
  mapsUrl: string
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-border/60 border-y border-border/60 py-3">
      <div className="flex min-w-0 gap-2 pr-3">
        <Clock
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-label="when"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{when}</p>
          <p className="truncate text-xs text-muted-foreground">{until}</p>
        </div>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`open ${placeName} in google maps`}
        className="flex min-w-0 gap-2 pl-3 active:opacity-70"
      >
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-sm font-medium">
            <span className="truncate underline decoration-border underline-offset-2">
              {placeName.toLowerCase()}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </p>
          {placeDetail && (
            <p className="truncate text-xs text-muted-foreground">
              {placeDetail.toLowerCase()}
            </p>
          )}
        </div>
      </a>
    </div>
  )
}

/**
 * The main action. An invited guest gets "join" (with an optional arrival
 * time while the flare is live or starting within 1h); a joined guest and the
 * host get "share an update". Nothing once the flare is over.
 */
export function FlareActions({
  viewer,
  timing,
  declined = false,
  eta,
  onEtaChange,
  saving = false,
  onJoin,
  onDecline,
  onShareUpdate,
}: {
  viewer: FlareViewer
  timing: FlareTiming
  /** The invited viewer already said they can't make it. */
  declined?: boolean
  eta: string | null
  onEtaChange: (eta: string | null) => void
  saving?: boolean
  onJoin: () => void
  onDecline: () => void
  onShareUpdate: () => void
}) {
  if (timing === "ended" || timing === "cancelled") return null
  const withEta = etaAvailable(timing)
  const etaKind = etaControlKind(timing)

  if (viewer === "invited") {
    return (
      <div>
        {withEta && (
          <p className="mb-1 text-xs leading-none text-muted-foreground">
            when will you get there?
          </p>
        )}
        <div className="flex items-center gap-1">
          {etaKind === "minutes" &&
            ETA_CHOICES.map((choice) => (
              <EtaChip
                key={choice}
                compact
                selected={eta === choice}
                onClick={() => onEtaChange(eta === choice ? null : choice)}
              >
                {shortEta(choice)}
              </EtaChip>
            ))}
          {etaKind === "status" &&
            ARRIVAL_STATUS_CHOICES.map((choice) => (
              <EtaChip
                key={choice.value}
                compact
                selected={eta === choice.value}
                onClick={() => onEtaChange(eta === choice.value ? null : choice.value)}
              >
                {choice.label}
              </EtaChip>
            ))}
          <Button
            className="h-10 min-w-0 flex-1 rounded-full bg-accent px-3 text-accent-foreground hover:bg-accent/90"
            disabled={saving}
            onClick={onJoin}
          >
            <Check className="h-4 w-4" /> join
          </Button>
          {!withEta && !declined && (
            <Button
              variant="ghost"
              className="h-10 shrink-0 rounded-full px-3 text-xs text-muted-foreground"
              disabled={saving}
              onClick={onDecline}
            >
              can&apos;t make it
            </Button>
          )}
        </div>
        {declined && (
          <p className="mt-1 text-xs text-muted-foreground">
            you said you can&apos;t make it · join if that changes
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        className="h-11 flex-1 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={onShareUpdate}
      >
        <Send className="h-4 w-4" /> share an update
      </Button>
      {viewer === "joined" && !withEta && (
        <Button
          variant="ghost"
          className="h-11 shrink-0 rounded-full px-3 text-xs text-muted-foreground"
          disabled={saving}
          onClick={onDecline}
        >
          can&apos;t make it
        </Button>
      )}
    </div>
  )
}

/**
 * A joined guest's own plan while an arrival time applies: "you're arriving
 * in 15 min" with change / cancel. Only the host ever sees it.
 */
export function YourPlan({
  summary,
  hostFirstName,
  hasEta,
  eta,
  timing,
  editing,
  onEditingChange,
  onEtaChange,
  onClearEta,
  onLeave,
  saving = false,
}: {
  summary: string
  hostFirstName: string
  hasEta: boolean
  eta: string | null
  /** Picks which picker reopens on "change" — minutes while live, status while soon. */
  timing: FlareTiming
  editing: boolean
  onEditingChange: (editing: boolean) => void
  onEtaChange: (eta: string) => void
  onClearEta: () => void
  onLeave: () => void
  saving?: boolean
}) {
  const etaKind = etaControlKind(timing)
  return (
    <div className="border-l-[3px] border-l-accent pl-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{summary}</p>
          <p className="text-xs text-muted-foreground">
            {hasEta
              ? `only ${hostFirstName} sees this`
              : `${hostFirstName} won't see an eta`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={saving}
          onClick={() => onEditingChange(!editing)}
        >
          {hasEta ? "change" : "add"}
        </Button>
        {hasEta && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground"
            disabled={saving}
            onClick={onClearEta}
          >
            cancel
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-2 flex gap-1.5">
          {etaKind === "minutes" &&
            ETA_CHOICES.map((choice) => (
              <EtaChip
                key={choice}
                selected={eta === choice}
                onClick={() => onEtaChange(choice)}
              >
                {choice}
              </EtaChip>
            ))}
          {etaKind === "status" &&
            ARRIVAL_STATUS_CHOICES.map((choice) => (
              <EtaChip
                key={choice.value}
                selected={eta === choice.value}
                onClick={() => onEtaChange(choice.value)}
              >
                {choice.label}
              </EtaChip>
            ))}
        </div>
      )}
      <button
        type="button"
        onClick={onLeave}
        disabled={saving}
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <X className="h-3 w-3" /> can&apos;t make it
      </button>
    </div>
  )
}

function shortEta(choice: (typeof ETA_CHOICES)[number]): string {
  return choice === "1 hr" ? "1h" : choice.replace(" min", "m")
}

function EtaChip({
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
