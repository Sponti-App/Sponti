"use client"

import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Check, Flame } from "lucide-react"
import { avatarText, events } from "@/lib/api/events/events"
import type { EventItem } from "@/lib/api/events/events"

const weekDays = ["m", "t", "w", "t", "f", "s", "s"]
const dates = [3, 4, 5, 6, 7, 8, 9]
const today = 4

const todayEvents = events.filter((e) => e.calendarDay === "today")
const tomorrowEvents = events.filter((e) => e.calendarDay === "tomorrow")

export function CalendarView({
  onEventSelect,
  joinedIds,
}: {
  onEventSelect: (event: EventItem) => void
  joinedIds: Set<number>
}) {
  const router = useRouter()
  return (
    /* pb-28 leaves room for the floating nav pill */
    <div className="h-full overflow-y-auto px-4 pb-28">
      {/* Month Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-medium italic">May</h2>
        <span className="text-sm text-muted-foreground">tue · may 4</span>
      </div>

      {/* Week Calendar */}
      <div className="mb-6 grid grid-cols-7 gap-1">
        {weekDays.map((day, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="mb-1 text-xs text-muted-foreground">{day}</span>
            <div
              className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg ${
                dates[i] === today ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <span
                className={`text-sm font-medium ${dates[i] === today ? "" : "italic"}`}
              >
                {dates[i]}
              </span>
              {(dates[i] === 4 || dates[i] === 6 || dates[i] === 7) && (
                <div
                  className={`mt-0.5 h-1 w-1 rounded-full ${
                    dates[i] === today
                      ? "bg-accent-foreground"
                      : "bg-foreground"
                  }`}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Today Section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-medium">today</h3>
          <span className="text-sm text-muted-foreground">
            {todayEvents.length} events
          </span>
        </div>
        <div className="space-y-2">
          {todayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              joined={joinedIds.has(event.id)}
              onSelect={onEventSelect}
            />
          ))}
        </div>
      </div>

      {/* Tomorrow Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-medium">tomorrow</h3>
          <span className="text-sm text-muted-foreground">
            {tomorrowEvents.length} event
          </span>
        </div>
        <div className="space-y-2">
          {tomorrowEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              joined={joinedIds.has(event.id)}
              onSelect={onEventSelect}
            />
          ))}
        </div>
      </div>

      {/* Make a plan CTA */}
      <button
        type="button"
        onClick={() => router.push("/event/new")}
        className="mt-3 flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-accent/50 bg-accent/5 px-4 py-3 text-left transition-colors hover:bg-accent/10"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Flame className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-accent">+ make a plan</p>
          <p className="text-xs text-muted-foreground">
            light a flare for any time this week
          </p>
        </div>
      </button>
    </div>
  )
}

function EventCard({
  event,
  joined,
  onSelect,
}: {
  event: EventItem
  joined: boolean
  onSelect: (event: EventItem) => void
}) {
  return (
    <Card
      className={`cursor-pointer flex-row items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50 active:bg-muted ${
        joined ? "border-accent bg-accent/5" : "border-border"
      }`}
      onClick={() => onSelect(event)}
    >
      <span className="w-10 shrink-0 text-sm text-muted-foreground">
        {event.calendarTime}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{event.title}</p>
          {joined && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              <Check className="h-2.5 w-2.5" /> going
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {event.location.name} · {event.going} going
        </p>
      </div>
      <div className="flex shrink-0 -space-x-1">
        {event.attendees.slice(0, 2).map((a, i) => (
          <Avatar
            key={i}
            className={`h-7 w-7 ${a.color !== "bg-accent" ? "border border-border" : ""}`}
          >
            <AvatarFallback
              className={`${a.color} ${avatarText(a.color)} text-xs`}
            >
              {a.avatar}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    </Card>
  )
}
