"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Check,
  Clock,
  Lock,
  MapPin,
  MoreVertical,
  Pencil,
  Send,
} from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/components/auth-provider"
import { EventAvatarStack, initials } from "@/components/event-avatar-stack"
import {
  deriveStatus,
  fetchHostedEventById,
  updateMyRsvp,
  type HostedEvent,
} from "@/lib/api/events"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type RsvpChoice = "going" | "declined" | null

const MIN = 60_000
const EVENT_TAB_TRIGGER_CLASS =
  "text-sm hover:text-primary data-active:text-primary dark:hover:text-primary dark:data-active:text-primary"

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [event, setEvent] = useState<HostedEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rsvp, setRsvp] = useState<RsvpChoice>(null)
  const [rsvpError, setRsvpError] = useState<string | null>(null)
  const [rsvpSaving, setRsvpSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [threadMessages, setThreadMessages] = useState<string[]>([
    "updates and replies will live here once backend thread support is added.",
  ])

  useEffect(() => {
    const ac = new AbortController()

    queueMicrotask(() => {
      if (ac.signal.aborted) return
      setLoading(true)
      setError(null)
    })

    fetchHostedEventById(params.id, ac.signal)
      .then((nextEvent) => {
        setEvent(nextEvent)
        setRsvp(rsvpChoiceFromApi(nextEvent.myRsvp))
        setLoading(false)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        setError(err instanceof Error ? err.message : "could not load flare")
        setLoading(false)
      })

    return () => ac.abort()
  }, [params.id])

  const addMessage = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) return
    setThreadMessages((current) => [...current, trimmed])
    setMessage("")
  }

  const handleRsvp = async (
    choice: Exclude<RsvpChoice, null>
  ): Promise<void> => {
    if (!event || rsvpSaving) return
    const previous = rsvp
    setRsvp(choice)
    setRsvpError(null)
    setRsvpSaving(true)
    try {
      await updateMyRsvp(event.id, { rsvpStatus: choice })
      setEvent((current) =>
        current ? { ...current, myRsvp: choice } : current
      )
    } catch (err) {
      setRsvp(previous)
      setRsvpError(err instanceof Error ? err.message : "could not update rsvp")
    } finally {
      setRsvpSaving(false)
    }
  }

  if (loading) {
    return (
      <FrameMessage
        title="loading flare..."
        onBack={() => router.push("/event")}
      />
    )
  }

  if (!event) {
    return (
      <FrameMessage
        title="flare not found"
        detail={error ?? "it may have been deleted or you may not have access."}
        onBack={() => router.push("/event")}
      />
    )
  }

  const status = deriveStatus(event)
  const isPast = status === "past"
  const isCancelled = status === "cancelled"
  const canManage = Boolean(
    searchParams.get("manage") === "1" && user && event.hostId === user.id
  )
  const hostName = (
    event.hostName ??
    event.hostUsername ??
    (canManage ? user?.displayName : null) ??
    "host"
  ).toLowerCase()
  const hostHandle =
    event.hostUsername ?? (canManage ? user?.username : undefined)
  const hostAvatarLabel = event.hostName ?? event.hostUsername ?? "host"
  const hostAvatarUrl = canManage ? user?.avatarUrl : event.hostAvatarUrl
  const description =
    event.description?.trim() ||
    "no description yet. the host can add more context from edit flare."
  const guests = event.attendees ?? []
  const goingNames = guests.map((guest) => guest.displayName.toLowerCase())

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="h-dvh overflow-y-auto pb-32">
        <header className="flex items-center justify-between px-4 pt-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/event")}
            aria-label="back"
            className="h-10 w-10 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {canManage ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/event/${event.id}/edit`)}
              aria-label="edit flare"
              disabled={isPast}
              className="h-10 w-10 rounded-full"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="more actions"
                  className="h-10 w-10 rounded-full"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem disabled>mute thread</DropdownMenuItem>
                <DropdownMenuItem disabled>leave flare</DropdownMenuItem>
                <DropdownMenuItem disabled variant="destructive">
                  report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <section className="px-4 pt-4">
          {(canManage || event.visibility === "private") && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {canManage && (
                <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  hosting
                </span>
              )}
              {event.visibility === "private" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  private
                </span>
              )}
            </div>
          )}

          <h1
            className={cn(
              "text-2xl leading-tight font-bold tracking-tight",
              isCancelled && "text-muted-foreground line-through"
            )}
          >
            {event.title.toLowerCase()}
          </h1>

          {rsvpError && (
            <p
              className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {rsvpError}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {!canManage && (
              <RsvpStatusControl
                value={rsvp}
                disabled={isPast || isCancelled || rsvpSaving}
                onChange={(choice) => void handleRsvp(choice)}
              />
            )}
            <InfoRow
              icon={Clock}
              title={formatTimeRange(event.startAt, event.endAt)}
              sub={durationLabel(event.startAt, event.endAt)}
            />
            <InfoRow
              icon={MapPin}
              title={event.locationLabel.toLowerCase()}
              sub={event.locationDetail?.toLowerCase()}
            />
            <InfoRowGuests
              guests={guests}
              title={goingCountLabel(event)}
              sub={guestSummary(goingNames)}
            />
          </div>
        </section>

        <section className="px-4 pt-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description.toLowerCase()}
          </p>
        </section>

        {!canManage && (
          <section className="px-4 pt-6">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-9">
                {hostAvatarUrl && <AvatarImage src={hostAvatarUrl} alt="" />}
                <AvatarFallback>{initials(hostAvatarLabel)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  hosted by {hostName}
                </p>
                {hostHandle && (
                  <p className="truncate text-xs text-muted-foreground">
                    @{hostHandle.toLowerCase()}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                disabled
                className="h-8 rounded-full px-3 text-xs"
              >
                message
              </Button>
            </div>
          </section>
        )}

        <Tabs defaultValue="guests" className="pt-6">
          <div className="px-4">
            <TabsList className="h-9 w-full">
              <TabsTrigger value="guests" className={EVENT_TAB_TRIGGER_CLASS}>
                guests
              </TabsTrigger>
              <TabsTrigger value="thread" className={EVENT_TAB_TRIGGER_CLASS}>
                thread
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="px-4 pt-1 pb-6">
            <TabsContent value="guests" className="m-0">
              <GuestList guests={guests} count={event.attendingCount} />
            </TabsContent>
            <TabsContent value="thread" className="m-0">
              <ThreadBlock
                message={message}
                messages={threadMessages}
                onMessage={setMessage}
                onSubmit={addMessage}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10">
        <div className="pointer-events-auto">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

function rsvpChoiceFromApi(value: HostedEvent["myRsvp"]): RsvpChoice {
  if (value === "going" || value === "declined") return value
  return null
}

function RsvpStatusControl({
  value,
  disabled,
  onChange,
}: {
  value: RsvpChoice
  disabled: boolean
  onChange: (choice: Exclude<RsvpChoice, null>) => void
}) {
  const displayValue = value ?? "declined"

  return (
    <div className="flex flex-wrap gap-1.5">
      <RsvpChip
        selected={displayValue === "going"}
        disabled={disabled}
        onClick={() => onChange("going")}
      >
        going
      </RsvpChip>
      <RsvpChip
        selected={displayValue === "declined"}
        disabled={disabled}
        onClick={() => onChange("declined")}
        mutedSelected
      >
        not going
      </RsvpChip>
    </div>
  )
}

function RsvpChip({
  selected,
  mutedSelected = false,
  disabled,
  onClick,
  children,
}: {
  selected: boolean
  mutedSelected?: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
        selected
          ? mutedSelected
            ? "border-border bg-card font-medium text-foreground"
            : "border-accent bg-accent/10 font-medium text-accent"
          : "border-border text-muted-foreground hover:bg-secondary"
      )}
    >
      {children}
    </button>
  )
}

function InfoRow({
  icon: Icon,
  title,
  sub,
}: {
  icon: LucideIcon
  title: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {sub && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        )}
      </div>
    </div>
  )
}

function InfoRowGuests({
  guests,
  title,
  sub,
}: {
  guests: NonNullable<HostedEvent["attendees"]>
  title: string
  sub: string | null
}) {
  return (
    <div className="flex items-start gap-3">
      <EventAvatarStack people={guests} size="sm" className="min-h-9 pt-1.5" />
      <div className="min-w-0 flex-1 pt-1.5">
        <p className="truncate text-sm font-semibold">{title}</p>
        {sub && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        )}
      </div>
    </div>
  )
}

function GuestList({
  guests,
  count,
}: {
  guests: NonNullable<HostedEvent["attendees"]>
  count: number
}) {
  return (
    <section className="pt-4">
      <GuestGroup label={`going (${count})`} guests={guests} />
    </section>
  )
}

function GuestGroup({
  label,
  guests,
}: {
  label: string
  guests: NonNullable<HostedEvent["attendees"]>
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {guests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          guest names will appear here once people say they are going.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {guests.map((guest, index) => (
            <div
              key={guest.id}
              className={cn(
                "flex items-center gap-2.5 py-2",
                index < guests.length - 1 && "border-b border-border/60"
              )}
            >
              <Avatar className="size-[30px]">
                {guest.avatarUrl && (
                  <AvatarImage src={guest.avatarUrl} alt="" />
                )}
                <AvatarFallback className="text-xs">
                  {initials(guest.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {guest.displayName.toLowerCase()}
                </p>
                {guest.username && (
                  <p className="truncate text-xs text-muted-foreground">
                    @{guest.username.toLowerCase()}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                going
              </span>
              <Check className="h-4 w-4 shrink-0 text-primary" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ThreadBlock({
  message,
  messages,
  onMessage,
  onSubmit,
}: {
  message: string
  messages: string[]
  onMessage: (value: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}) {
  const renderedMessages = useMemo(() => [...messages].reverse(), [messages])

  return (
    <section className="pt-4">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-full bg-secondary py-1 pr-1.5 pl-3"
      >
        <input
          value={message}
          onChange={(e) => onMessage(e.target.value)}
          placeholder="write an update..."
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
        <button
          type="submit"
          aria-label="post update"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3.5">
        {renderedMessages.map((item, index) => (
          <div key={`${item}-${index}`} className="flex gap-2.5">
            <Avatar className="size-[30px]">
              <AvatarFallback className="text-xs">
                {index === renderedMessages.length - 1 ? "S" : "Y"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {index === renderedMessages.length - 1 ? "sponti" : "you"}
                </span>{" "}
                · now
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {item.toLowerCase()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatTimeRange(startIso: string, endIso: string): string {
  const day = formatStartDay(startIso)
  return `${day} · ${formatClock(startIso)}-${formatClock(endIso)}`
}

function formatStartDay(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  if (sameDay) return "today"
  if (isTomorrow) return "tomorrow"
  return d
    .toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toLowerCase()
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const hour = hours % 12 || 12
  const minute = String(minutes).padStart(2, "0")
  const period = hours >= 12 ? "pm" : "am"
  return `${hour}:${minute}${period}`
}

function durationLabel(startIso: string, endIso: string): string {
  const minutes = Math.max(
    1,
    Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / MIN
    )
  )
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

function goingCountLabel(event: HostedEvent): string {
  const cap = capacityForEvent(event)
  if (cap) {
    return `${event.attendingCount} of ${cap} going`
  }
  return `${event.attendingCount} going`
}

function capacityForEvent(event: HostedEvent): number | undefined {
  if (event.guestLimit > event.attendingCount) return event.guestLimit
  if (event.attendeeCount > event.attendingCount) return event.attendeeCount
  return undefined
}

function guestSummary(names: string[]): string | null {
  if (names.length === 0) return null
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`
}

function FrameMessage({
  title,
  detail,
  onBack,
}: {
  title: string
  detail?: string
  onBack: () => void
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      <Button
        onClick={onBack}
        className="mt-4 rounded-full bg-accent text-accent-foreground"
      >
        back to flares
      </Button>
    </div>
  )
}
