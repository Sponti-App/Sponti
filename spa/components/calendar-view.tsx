"use client"

import { useMemo, useState } from "react"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  AlertCircle,
  Calendar as CalendarIcon,
} from "lucide-react"
import {
  avatarText,
  dayKey,
  eventDayKey,
  formatEventTime,
  isJoined,
  isLive,
  type EventItem,
} from "@/lib/api/events"
import { useCalendarEvents } from "@/lib/use-events"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

// Match the event-creation date strip: short weekday + "today"/"tmrw" alias.
function formatDayChip(
  d: Date,
  today: Date
): { weekday: string; date: string } {
  if (isSameDay(d, today))
    return { weekday: "today", date: String(d.getDate()) }
  if (isSameDay(d, addDays(today, 1)))
    return { weekday: "tmrw", date: String(d.getDate()) }
  return {
    weekday: d
      .toLocaleDateString(undefined, { weekday: "short" })
      .toLowerCase(),
    date: String(d.getDate()),
  }
}

// Calendar horizon — we cap visibility two weeks past today.
const MAX_DAYS_AHEAD = 14

function startOfWeek(date: Date): Date {
  // Monday-based week
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = (day + 6) % 7 // days back to Monday
  d.setDate(d.getDate() - diff)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

// ISO-style: a week "belongs to" the month containing its Thursday.
// Returns e.g. "1st week of May 2026".
function weekHeaderLabel(weekStart: Date): string {
  const thursday = addDays(weekStart, 3)
  const month = thursday.getMonth()
  const year = thursday.getFullYear()
  let count = 0
  for (let day = 1; day <= thursday.getDate(); day++) {
    if (new Date(year, month, day).getDay() === 4) count++
  }
  return `${ordinal(count)} week of ${MONTH_NAMES[month]} ${year}`
}

function formatSectionLabel(day: Date, today: Date): string {
  if (isSameDay(day, today)) return "today"
  if (isSameDay(day, addDays(today, 1))) return "tomorrow"
  if (isSameDay(day, addDays(today, -1))) return "yesterday"
  return day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

export function CalendarView({
  onEventSelect,
  joinedIds,
}: {
  onEventSelect: (event: EventItem) => void
  joinedIds: Set<string>
}) {
  const { openDrawer } = useNewEventDrawer()
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [anchor, setAnchor] = useState<Date>(today) // controls visible week
  const [selected, setSelected] = useState<Date>(today)
  const { events, loading, error, refresh } = useCalendarEvents()

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  // Bucket events by their local day key so we can render dots + sections.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const event of events) {
      const key = eventDayKey(event)
      const bucket = map.get(key)
      if (bucket) bucket.push(event)
      else map.set(key, [event])
    }
    // Sort each bucket by start time
    for (const bucket of map.values()) {
      bucket.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      )
    }
    return map
  }, [events])

  const selectedEvents = eventsByDay.get(dayKey(selected)) ?? []
  // Upcoming (after the selected day) — show as agenda below the selection
  const agenda = useMemo(() => {
    const selKey = dayKey(selected)
    const horizonKey = dayKey(addDays(new Date(), MAX_DAYS_AHEAD))
    const list: Array<{ day: Date; items: EventItem[] }> = []
    const seen = new Set<string>()
    for (const event of events) {
      const key = eventDayKey(event)
      if (key <= selKey) continue
      if (key > horizonKey) continue
      if (seen.has(key)) continue
      seen.add(key)
      const items = eventsByDay.get(key) ?? []
      list.push({ day: new Date(`${key}T00:00:00`), items })
    }
    return list.slice(0, 5)
  }, [events, eventsByDay, selected])

  const headerLabel = weekHeaderLabel(weekStart)

  // Two-week horizon: max selectable day is today + 14d. Disable Next when
  // the entire next week sits past that cap.
  const maxDate = useMemo(() => addDays(today, MAX_DAYS_AHEAD), [today])
  const nextWeekStart = useMemo(() => addDays(weekStart, 7), [weekStart])
  const canGoNext = nextWeekStart.getTime() <= maxDate.getTime()
  const showTodayPill = !isSameDay(weekStart, startOfWeek(today))

  const goPrevWeek = () => setAnchor((d) => addDays(d, -7))
  const goNextWeek = () => {
    if (!canGoNext) return
    setAnchor((d) => addDays(d, 7))
  }
  const goToday = () => {
    setAnchor(today)
    setSelected(today)
  }

  return (
    /* pb-28 leaves room for the floating nav pill */
    <div className="h-full overflow-y-auto px-4 pt-14 pb-28">
      {/* Sticky header + week strip — stays pinned while the agenda scrolls.
          top-14 clears the floating header chip row (~56px). */}
      <div className="sticky top-14 z-10 -mx-4 border-b border-border/60 bg-background px-4 pt-2 pb-2">
        {/* Week Header with nav */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-xl font-semibold">{headerLabel}</h2>
            {showTodayPill && (
              <button
                type="button"
                onClick={goToday}
                className="shrink-0 rounded-full border border-accent/40 px-2 py-0.5 text-xs font-medium text-accent"
              >
                today
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={goPrevWeek}
              aria-label="Previous week"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-secondary active:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNextWeek}
              disabled={!canGoNext}
              aria-label="Next week"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-secondary active:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Week strip — chip style mirrors the event-creation date strip */}
        <div className="mb-6 grid grid-cols-7 gap-1.5">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today)
            const isSelected = isSameDay(day, selected)
            const hasEvents = (eventsByDay.get(dayKey(day))?.length ?? 0) > 0
            const beyondHorizon = day.getTime() > maxDate.getTime()
            const chip = formatDayChip(day, today)
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  if (beyondHorizon) return
                  setSelected(day)
                }}
                disabled={beyondHorizon}
                aria-pressed={isSelected}
                aria-label={day.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                className={`flex flex-col items-center rounded-xl border px-1 py-2 transition-colors ${
                  beyondHorizon
                    ? "cursor-not-allowed border-border/40 bg-background opacity-40"
                    : isSelected
                      ? "border-accent bg-accent/10"
                      : isToday
                        ? "border-accent/60 bg-background hover:bg-secondary"
                        : "border-border bg-background hover:bg-secondary"
                }`}
              >
                <span
                  className={`text-[11px] ${
                    isSelected
                      ? "text-accent"
                      : isToday
                        ? "text-accent"
                        : "text-muted-foreground"
                  }`}
                >
                  {chip.weekday}
                </span>
                <span
                  className={`mt-0.5 text-base leading-none font-medium ${
                    isSelected || isToday ? "text-accent" : "text-foreground"
                  }`}
                >
                  {chip.date}
                </span>
                <div
                  className={`mt-1 h-1 w-1 rounded-full ${
                    hasEvents
                      ? isSelected || isToday
                        ? "bg-accent"
                        : "bg-foreground"
                      : "bg-transparent"
                  }`}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-4" />

      {/* Selected day section */}
      <DaySection
        label={formatSectionLabel(selected, today)}
        events={selectedEvents}
        joinedIds={joinedIds}
        onSelect={onEventSelect}
        emptyAction={
          <button
            type="button"
            onClick={openDrawer}
            className="mt-3 flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-accent/50 bg-accent/5 px-4 py-3 text-left transition-colors hover:bg-accent/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-accent">+ make a plan</p>
              <p className="text-xs text-muted-foreground">
                light a flare for any day this week
              </p>
            </div>
          </button>
        }
      />

      {/* Errors / loading */}
      {loading && events.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          loading events…
        </p>
      )}
      {error && (
        <div className="my-4 rounded-xl border border-border p-4 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
          <p className="mb-3 text-sm text-muted-foreground">{error}</p>
          <button onClick={refresh} className="text-sm font-medium text-accent">
            try again
          </button>
        </div>
      )}

      {/* Up-next agenda — events after the selected day */}
      {agenda.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              up next
            </h3>
          </div>
          <div className="space-y-5">
            {agenda.map(({ day, items }) => (
              <div key={day.toISOString()}>
                <button
                  type="button"
                  onClick={() => {
                    setAnchor(day)
                    setSelected(day)
                  }}
                  className="mb-2 text-sm font-medium transition-colors hover:text-accent"
                >
                  {formatSectionLabel(day, today)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {items.length} event{items.length === 1 ? "" : "s"}
                  </span>
                </button>
                <div className="space-y-2">
                  {items.slice(0, 2).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      joined={isJoined(event, joinedIds)}
                      onSelect={onEventSelect}
                    />
                  ))}
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnchor(day)
                        setSelected(day)
                      }}
                      className="text-xs font-medium text-accent"
                    >
                      + {items.length - 2} more on{" "}
                      {formatSectionLabel(day, today)}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DaySection({
  label,
  events,
  joinedIds,
  onSelect,
  emptyAction,
}: {
  label: string
  events: EventItem[]
  joinedIds: Set<string>
  onSelect: (event: EventItem) => void
  emptyAction?: React.ReactNode
}) {
  return (
    <div className="mb-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-medium">{label}</h3>
        <span className="text-sm text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">nothing on the books</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              joined={isJoined(event, joinedIds)}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      {events.length === 0 && emptyAction}
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
  const live = isLive(event)
  return (
    <Card
      className={`cursor-pointer flex-row items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50 active:bg-muted ${
        joined ? "border-accent bg-accent/5" : "border-border"
      }`}
      onClick={() => onSelect(event)}
    >
      <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">
        {formatEventTime(event)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{event.title}</p>
          {live && (
            <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
              live
            </span>
          )}
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
