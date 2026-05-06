"use client"

import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const weekDays = ["m", "t", "w", "t", "f", "s", "s"]
const dates = [3, 4, 5, 6, 7, 8, 9]
const today = 4

export function CalendarView() {
  return (
    <div className="h-full overflow-y-auto px-4 pb-4">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-medium italic">May</h2>
        <span className="text-sm text-muted-foreground">tue · may 4</span>
      </div>

      {/* Week Calendar */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {weekDays.map((day, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">{day}</span>
            <div
              className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg ${
                dates[i] === today
                  ? "bg-[#e85a4f] text-background"
                  : ""
              }`}
            >
              <span className={`text-sm font-medium ${dates[i] === today ? "" : "italic"}`}>
                {dates[i]}
              </span>
              {(dates[i] === 4 || dates[i] === 6 || dates[i] === 7) && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${
                  dates[i] === today ? "bg-background" : "bg-foreground"
                }`} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Today Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">today</h3>
          <span className="text-sm text-muted-foreground">2 events</span>
        </div>

        <div className="space-y-2">
          <EventCard
            time="3pm"
            title="coffee w/ Mira"
            subtitle="Reuben's · 1:1"
            avatars={[{ letter: "M", bg: "bg-[#e85a4f]" }]}
          />
          <EventCard
            time="7pm"
            title="patio hang"
            subtitle="hosting · 4 going"
            avatars={[
              { letter: "S", bg: "bg-muted", outlined: true },
              { letter: "K", bg: "bg-muted", outlined: true },
            ]}
          />
        </div>
      </div>

      {/* Tomorrow Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">tomorrow</h3>
          <span className="text-sm text-muted-foreground">1 event</span>
        </div>

        <EventCard
          time="10am"
          title="run club"
          subtitle="park · 6 going"
          avatars={[{ letter: "J", bg: "bg-muted", outlined: true }]}
        />
      </div>
    </div>
  )
}

function EventCard({
  time,
  title,
  subtitle,
  avatars,
}: {
  time: string
  title: string
  subtitle: string
  avatars: Array<{ letter: string; bg: string; outlined?: boolean }>
}) {
  return (
    <Card className="p-3 flex-row items-center gap-3 border border-border rounded-xl">
      <span className="text-sm text-muted-foreground w-12">{time}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex -space-x-1">
        {avatars.map((avatar, i) => (
          <Avatar 
            key={i} 
            className={`h-7 w-7 ${avatar.outlined ? "border border-foreground" : ""}`}
          >
            <AvatarFallback 
              className={`${avatar.bg} ${avatar.outlined ? "text-foreground" : "text-background"} text-xs`}
            >
              {avatar.letter}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    </Card>
  )
}
