"use client"

import Link from "next/link"
import { Check, Clock, Lock, MapPin, MoreHorizontal, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { type EventStatus, type HostedEvent } from "@/lib/api/events"
import { EventAvatarStack, initials } from "@/components/event-avatar-stack"
import { EVENT_TYPES } from "@/types/utils"
import { cn } from "@/lib/utils"

function formatStartParts(iso: string): { day: string; time: string } {
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
  const time = formatClock(d)
  if (sameDay) return { day: "today", time }
  if (isTomorrow) return { day: "tomorrow", time }
  return {
    day: d
      .toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      .toLowerCase(),
    time,
  }
}

function formatClock(d: Date): string {
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const hour = hours % 12 || 12
  const minute = String(minutes).padStart(2, "0")
  const period = hours >= 12 ? "pm" : "am"
  return `${hour}:${minute}${period}`
}

function statusLabel(status: EventStatus): string | null {
  if (status === "cancelled") return "cancelled"
  if (status === "live") return "live"
  if (status === "past") return "finished"
  return null
}

function rsvpLabel(rsvp: HostedEvent["myRsvp"]): string {
  if (rsvp === "going") return "going"
  if (rsvp === "declined") return "not going"
  return "invited"
}

export function EventHostCard({
  event,
  status,
  canManage = false,
}: {
  event: HostedEvent
  status: EventStatus
  canManage?: boolean
}) {
  const { user } = useAuth()
  const { day, time } = formatStartParts(event.startAt)
  const hostName = canManage
    ? "you"
    : (event.hostName ?? event.hostUsername ?? "host").toLowerCase()
  const avatarLabel = canManage
    ? (user?.displayName ?? user?.username ?? "you")
    : (event.hostName ?? event.hostUsername ?? "host")
  const avatarUrl = canManage ? user?.avatarUrl : event.hostAvatarUrl
  const displayStatus = statusLabel(status)
  const showRsvpStatus = !canManage
  const isGoing = event.myRsvp === "going"
  const isDeclined = event.myRsvp === "declined"
  const ActivityIcon =
    EVENT_TYPES.find((type) => type.value === event.type)?.icon ?? Clock

  return (
    <Link
      href={`/event/${event.id}${canManage ? "?manage=1" : ""}`}
      aria-label={`open details for ${event.title}`}
      className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <article
        className={cn(
          "relative flex flex-col gap-2 rounded-xl border border-border bg-background p-3 text-card-foreground transition-colors",
          event.apiStatus === "cancelled" && "bg-secondary/40"
        )}
      >
        <div
          className="pointer-events-none absolute top-3 right-3 flex h-7 w-7 items-center justify-center text-muted-foreground/70"
          aria-hidden
        >
          <MoreHorizontal className="h-4 w-4" />
        </div>

        <div className="flex min-w-0 items-center gap-2.5 pr-8">
          <Avatar className="size-7">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-xs">
              {initials(avatarLabel)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{hostName}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="truncate">
                {day} · {time}
              </span>
            </p>
          </div>
          {displayStatus && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {displayStatus}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <ActivityIcon className="h-4 w-4" />
          </div>
          <h2
            className={cn(
              "line-clamp-2 min-w-0 text-base leading-snug font-semibold",
              event.apiStatus === "cancelled" &&
                "text-muted-foreground line-through"
            )}
          >
            {event.title.toLowerCase()}
          </h2>
        </div>

        <div className="flex min-w-0 items-center gap-2.5 pt-0.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {event.locationLabel.toLowerCase()}
          </span>
          {showRsvpStatus && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 font-medium",
                isGoing ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isGoing && <Check className="h-3.5 w-3.5" />}
              {isDeclined && <X className="h-3.5 w-3.5" />}
              {rsvpLabel(event.myRsvp)}
            </span>
          )}
          {event.visibility === "private" && (
            <>
              <span className="h-3 w-px shrink-0 bg-border" />
              <Lock className="h-3 w-3 shrink-0" aria-label="private" />
            </>
          )}
          <EventAvatarStack
            people={event.attendees ?? []}
            count={event.attendingCount}
            cap={capacityForEvent(event)}
            size="xs"
            className="ml-auto"
          />
        </div>
      </article>
    </Link>
  )
}

function capacityForEvent(event: HostedEvent): number | undefined {
  if (event.guestLimit > event.attendingCount) return event.guestLimit
  if (event.attendeeCount > event.attendingCount) return event.attendeeCount
  return undefined
}
