"use client"

import { useState } from "react"
import { MapView } from "@/components/map-view"
import { CalendarView } from "@/components/calendar-view"
import { BottomNav } from "@/components/bottom-nav"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bell, Map, Calendar } from "lucide-react"

export default function Home() {
  const [view, setView] = useState<"map" | "calendar">("map")

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Mobile Frame */}
      <div className="w-[390px] h-[844px] bg-background rounded-[40px] border-[8px] border-foreground relative overflow-hidden flex flex-col">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2">
          <span className="text-sm font-medium">9:41</span>
          <div className="w-[80px] h-[24px] bg-foreground rounded-full" />
          <div className="flex items-center gap-1">
            <span className="text-xs">•••</span>
            <span className="text-xs">◗</span>
            <span className="text-xs">▌</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <Avatar className="h-9 w-9 border border-foreground">
            <AvatarFallback className="bg-background text-sm font-medium">M</AvatarFallback>
          </Avatar>

          {/* Toggle */}
          <div className="flex items-center border border-foreground rounded-full p-1">
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                view === "map" ? "bg-foreground text-background" : ""
              }`}
            >
              <Map className="h-4 w-4" />
              <span>map</span>
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                view === "calendar" ? "bg-foreground text-background" : ""
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>calendar</span>
            </button>
          </div>

          <button className="h-9 w-9 rounded-full border border-foreground flex items-center justify-center">
            <Bell className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === "map" ? <MapView /> : <CalendarView />}
        </div>

        {/* Bottom Navigation */}
        <BottomNav />

        {/* Home Indicator */}
        <div className="flex justify-center pb-2 pt-1">
          <div className="w-32 h-1 bg-foreground rounded-full" />
        </div>
      </div>
    </div>
  )
}
