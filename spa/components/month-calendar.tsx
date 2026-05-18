"use client"

import React, { useMemo } from "react"
import { dayKey, isJoined } from "@/lib/api/events"
import type { EventItem } from "@/lib/api/events"
import { useAuth } from "@/components/auth-provider"

export default function MonthCalendar({
    anchorMonth,
    selected,
    today,
    eventsByDay,
    onSelectDay,
    onEventSelect,
    joinedIds,
}: {
    anchorMonth: Date
    selected: Date
    today: Date
    eventsByDay: Map<string, EventItem[]>
    onSelectDay: (d: Date) => void
    onEventSelect: (e: EventItem) => void
    joinedIds: Set<string>
}) {
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

    const { user } = useAuth()

    return (
        <div className="mb-2">
            <div className="mb-1.5 grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                    <div key={day}>{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                    const isToday = dayKey(day) === dayKey(today)
                    const isSelected = dayKey(day) === dayKey(selected)
                    const isCurrentMonth = day.getMonth() === month
                    const events = eventsByDay.get(dayKey(day)) ?? []
                    const mutedClass = isCurrentMonth ? "" : "opacity-40"
                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => onSelectDay(day)}
                            aria-pressed={isSelected}
                            aria-label={day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                            className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-center transition-all duration-200 ${isSelected
                                    ? "border-accent bg-accent/10"
                                    : "border-border bg-background"
                                } ${mutedClass}`}
                        >
                            <span className={`text-sm font-medium leading-none ${isSelected || isToday ? "text-accent" : "text-foreground"}`}>{day.getDate()}</span>

                            <div className="mt-1 flex h-1.5 items-center justify-center gap-0.5">
                                {events.slice(0, 3).map((event) => {
                                    const eventIsHost = event.host.id === user?.id
                                    const eventJoined = isJoined(event, joinedIds)
                                    return (
                                        <span
                                            key={event.id}
                                            className={`h-1 w-1 rounded-full ${eventIsHost
                                                ? "bg-destructive"
                                                : eventJoined
                                                    ? "bg-accent"
                                                    : "bg-muted-foreground"
                                                }`}
                                            aria-hidden
                                        />
                                    )
                                })}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
