export function isImminent(event: EventItem): boolean {
  // Is imminent should check it by datetime
}

export function avatarText(bgColor: string): string {
  return bgColor === "bg-accent" || bgColor === "bg-stone-800"
    ? "text-accent-foreground"
    : "text-foreground"
}

type EventsType = {
  type: "hangout" | "sports" | "drinks"
  icon: string
}

// Response DTO ?
// Maybe location.area, calendarTime, calendarDay, type not need
export interface EventItem {
  id: number
  title: string
  type: EventsType
  status: "active" | "cancelled" | "completed"
  calendarTime?: string
  calendarDay?: "today" | "tomorrow"
  host: {
    name: string
    avatar: string
    color: string
    note: string
  }
  location: {
    name: string
    area: string
    distance: string
    walkTime: string
  }
  attendees: Array<{ name: string; avatar: string; color: string }>
  going: number
  position?: { lat: number; lng: number }
}

export const events: EventItem[] = [
  {
    id: 3,
    title: "run club",
    type: "run",
    status: "10am tomorrow",
    calendarTime: "10am",
    calendarDay: "tomorrow",
    host: {
      name: "J",
      avatar: "J",
      color: "bg-stone-400",
      note: "meet at the main gate, bring water!",
    },
    location: {
      name: "Dolores Park",
      area: "Mission",
      distance: "1.2 mi",
      walkTime: "25 min walk",
    },
    attendees: [{ name: "J", avatar: "J", color: "bg-stone-400" }],
    going: 6,
  },
]
