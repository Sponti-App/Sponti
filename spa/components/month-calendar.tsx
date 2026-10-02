"use client"

import {
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from "react"
import { dayKey } from "@/lib/api/events"
import type { EventItem } from "@/lib/api/events"
import { formatDayLong } from "@/lib/format-date"
import { useMonthCollapse } from "@/lib/use-month-collapse"

const WEEKDAY_LABELS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

// Fixed row height — never aspect-square — so the full month plus the header
// still leaves room for the agenda list on a phone screen. Short screens
// (e.g. 320×568) get tighter rows so even a 6-row month leaves the selected
// day's first flare visible above the tab bar.
const ROWS = { height: 36, gap: 4 }
const COMPACT_ROWS = { height: 30, gap: 2 }
const COMPACT_ROWS_QUERY = "(max-height: 640px)"

function rowMetrics(compact: boolean) {
  const { height, gap } = compact ? COMPACT_ROWS : ROWS
  return { height, gap, step: height + gap }
}

function subscribeToCompactRows(onChange: () => void) {
  const query = window.matchMedia(COMPACT_ROWS_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** True on short viewports, where the month grid uses compact rows. */
export function useCompactMonthRows(): boolean {
  return useSyncExternalStore(
    subscribeToCompactRows,
    () => window.matchMedia(COMPACT_ROWS_QUERY).matches,
    () => false
  )
}
// Space under the pinned week row (pb-3) plus its 1px bottom border. Part of
// the header's in-flow height, so the list always starts below it.
const PINNED_ROW_PADDING_PX = 12 + 1

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

/** Number of Monday-first week rows the month grid for `anchorMonth` has (4–6). */
export function monthWeekCount(anchorMonth: Date): number {
  const first = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1)
  const last = new Date(
    anchorMonth.getFullYear(),
    anchorMonth.getMonth() + 1,
    0
  )
  const start = startOfWeek(first)
  const end = endOfWeek(last)
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  return Math.round(days / 7)
}

/**
 * How far (px) the list scrolls to collapse the month overlay to its pinned
 * week row: exactly the height of the rows the overlay hides. The overlay
 * shrinks 1px per 1px scrolled, so its bottom edge moves in lockstep with the
 * list and never covers the top of it. The list reserves this much space
 * above the selected day's section (see `CalendarView`), so at scroll-top the
 * first flare starts right under the expanded month.
 */
export function monthCollapseDistance(
  anchorMonth: Date,
  compact = false
): number {
  return (monthWeekCount(anchorMonth) - 1) * rowMetrics(compact).step
}

export default function MonthCalendar({
  anchorMonth,
  selected,
  today,
  eventsByDay,
  onSelectDay,
  maxDate,
  scrollContainerRef,
  compact = false,
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
  /** Tighter rows for short viewports; see `useCompactMonthRows`. */
  compact?: boolean
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

  const rows = rowMetrics(compact)
  const collapseDistance = monthCollapseDistance(anchorMonth, compact)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  useMonthCollapse(scrollContainerRef, overlayRef, collapseDistance)

  // Two layers (#224):
  // 1. The in-flow slot below the weekday labels is exactly one week row
  //    tall. It is all the header contributes to layout, so the list below
  //    never moves as the month collapses.
  // 2. The month itself is an overlay anchored to the top of that slot. While
  //    expanded it hangs down over the list; as the list scrolls,
  //    `--month-collapse` (0 -> 1) shrinks its clip by the same number of
  //    pixels scrolled and slides the rows up until only the selected day's
  //    week is left, sitting exactly on the slot.
  const pinnedOffsetPx = selectedWeekIndex * rows.step
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div
        className="relative -mx-4"
        style={{ height: rows.height + PINNED_ROW_PADDING_PX }}
      >
        <div
          ref={overlayRef}
          className="absolute inset-x-0 top-0 border-b border-border/60 bg-background px-4 pb-3"
          style={{ "--month-collapse": 0 } as CSSProperties}
        >
          <div
            className="overflow-hidden"
            style={{
              height: `calc(${rows.height}px + (1 - var(--month-collapse)) * ${collapseDistance}px)`,
            }}
          >
            <div
              className="flex flex-col"
              style={{
                gap: rows.gap,
                transform: `translateY(calc(var(--month-collapse) * ${-pinnedOffsetPx}px))`,
              }}
            >
              {weeks.map((week, weekIndex) => (
                <div
                  key={week[0].toISOString()}
                  className="grid grid-cols-7 gap-1"
                  style={{
                    height: rows.height,
                    // The pinned week stays solid; the rest fade as they
                    // slide out of the clip.
                    opacity:
                      weekIndex === selectedWeekIndex
                        ? undefined
                        : "calc(1 - var(--month-collapse))",
                  }}
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
                        aria-label={formatDayLong(day)}
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
