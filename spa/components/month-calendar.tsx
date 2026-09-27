"use client"

import { useMemo, useRef, type CSSProperties, type RefObject } from "react"
import { dayKey } from "@/lib/api/events"
import type { EventItem } from "@/lib/api/events"
import { useMonthCollapse } from "@/lib/use-month-collapse"

const WEEKDAY_LABELS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

// How far (px) the agenda list scrolls before the month grid is fully
// collapsed to the selected day's week row. Scroll-linked, not a timer: each
// frame maps 1:1 to a collapse fraction over this distance.
const COLLAPSE_DISTANCE_PX = 120

// Fixed row height — never aspect-square — so the full 6-row month plus the
// sticky header still leaves room for the agenda list on a phone screen.
const ROW_HEIGHT_PX = 36
const ROW_GAP_PX = 4

// Helpers (local to avoid coupling)
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  return d
}
function endOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = 6 - ((day + 6) % 7)
  d.setDate(d.getDate() + diff)
  return d
}
function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export default function MonthCalendar({
  anchorMonth,
  selected,
  today,
  eventsByDay,
  onSelectDay,
  maxDate,
  scrollContainerRef,
}: {
  anchorMonth: Date
  selected: Date
  today: Date
  eventsByDay: Map<string, EventItem[]>
  onSelectDay: (d: Date) => void
  /** Navigation horizon (current month + next, per the week strip) — days after this are disabled. */
  maxDate: Date
  /** The agenda list's scroll container; the collapse tracks its scroll position. */
  scrollContainerRef: RefObject<HTMLDivElement | null>
}) {
  const year = anchorMonth.getFullYear()
  const month = anchorMonth.getMonth()
  const firstOfMonth = useMemo(() => new Date(year, month, 1), [year, month])
  const gridStart = useMemo(() => startOfWeek(firstOfMonth), [firstOfMonth])

  const days = useMemo(() => {
    const endOfMonth = new Date(year, month + 1, 0)
    const gridEnd = endOfWeek(endOfMonth)
    const result: Date[] = []
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      result.push(new Date(d))
    }
    return result
  }, [gridStart, year, month])

  // Grouped into week rows so the collapse can hide every row but the one
  // holding `selected`, which is what stays pinned under the header.
  const weeks = useMemo(() => {
    const chunks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7))
    return chunks
  }, [days])

  const selectedKey = dayKey(selected)
  const selectedWeekIndex = useMemo(() => {
    const idx = weeks.findIndex((week) =>
      week.some((d) => dayKey(d) === selectedKey)
    )
    return idx === -1 ? 0 : idx
  }, [weeks, selectedKey])

  const gridRef = useRef<HTMLDivElement | null>(null)
  useMonthCollapse(scrollContainerRef, gridRef, COLLAPSE_DISTANCE_PX)

  return (
    <div className="mb-2">
      <div className="mb-1.5 grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div
        ref={gridRef}
        className="flex flex-col"
        style={{ "--month-collapse": 0 } as CSSProperties}
      >
        {weeks.map((week, weekIndex) => {
          const isSelectedRow = weekIndex === selectedWeekIndex
          const isLastRow = weekIndex === weeks.length - 1
          // The selected week's row never shrinks — every other row collapses
          // toward zero height as `--month-collapse` (written by the scroll
          // effect above) goes from 0 to 1, leaving just that row pinned.
          const rowStyle: CSSProperties = isSelectedRow
            ? { height: ROW_HEIGHT_PX, marginBottom: isLastRow ? 0 : ROW_GAP_PX }
            : {
                height: `calc((1 - var(--month-collapse)) * ${ROW_HEIGHT_PX}px)`,
                opacity: "calc(1 - var(--month-collapse))",
                marginBottom: isLastRow
                  ? 0
                  : `calc((1 - var(--month-collapse)) * ${ROW_GAP_PX}px)`,
              }
          return (
            <div
              key={week[0].toISOString()}
              className="overflow-hidden"
              style={rowStyle}
            >
              <div
                className="grid grid-cols-7 gap-1"
                style={{ height: ROW_HEIGHT_PX }}
              >
                {week.map((day) => {
                  const dKey = dayKey(day)
                  const isToday = dKey === dayKey(today)
                  const isSelected = dKey === selectedKey
                  const isCurrentMonth = day.getMonth() === month
                  const hasEvents = (eventsByDay.get(dKey)?.length ?? 0) > 0
                  const beyondHorizon = day.getTime() > maxDate.getTime()
                  const mutedClass =
                    isCurrentMonth || beyondHorizon ? "" : "opacity-40"
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        if (beyondHorizon) return
                        onSelectDay(day)
                      }}
                      disabled={beyondHorizon}
                      aria-pressed={isSelected}
                      aria-label={day.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                      className={`flex h-full flex-col items-center justify-center rounded-lg transition-colors active:scale-[0.97] ${mutedClass} ${
                        beyondHorizon
                          ? "cursor-not-allowed opacity-30"
                          : isSelected
                            ? "bg-card"
                            : "hover:bg-secondary"
                      }`}
                    >
                      <span
                        className={`text-sm leading-none font-medium ${
                          isSelected
                            ? "text-primary"
                            : isToday
                              ? "text-accent"
                              : "text-foreground"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <div
                        className={`mt-1 h-1 w-1 rounded-full ${
                          hasEvents
                            ? isSelected
                              ? "bg-primary"
                              : isToday
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
          )
        })}
      </div>
    </div>
  )
}
