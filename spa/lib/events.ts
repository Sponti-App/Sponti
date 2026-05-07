export function isImminent(event: EventItem): boolean {
  return event.status === "happening now"
}

export function avatarText(bgColor: string): string {
  return bgColor === "bg-accent" || bgColor === "bg-stone-800"
    ? "text-accent-foreground"
    : "text-foreground"
}

export interface EventItem {
  id: number
  title: string
  type: "coffee" | "hang" | "run"
  status: string
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
    id: 1,
    title: "coffee at Reuben's",
    type: "coffee",
    status: "happening now",
    calendarTime: "3pm",
    calendarDay: "today",
    host: {
      name: "Mira",
      avatar: "M",
      color: "bg-accent",
      note: "grabbing a latte before my 4pm — pop by if you're around ☕",
    },
    location: {
      name: "Reuben's Espresso",
      area: "Fillmore",
      distance: "0.4 mi",
      walkTime: "8 min walk",
    },
    attendees: [
      { name: "Mira", avatar: "M", color: "bg-accent" },
      { name: "Sam", avatar: "S", color: "bg-stone-300" },
    ],
    going: 2,
    position: { lat: 37.7855, lng: -122.4364 },
  },
  {
    id: 2,
    title: "patio hang",
    type: "hang",
    status: "7pm",
    calendarTime: "7pm",
    calendarDay: "today",
    host: {
      name: "Sam",
      avatar: "S",
      color: "bg-stone-800",
      note: "patio hangs at my place, bring snacks!",
    },
    location: {
      name: "the patio",
      area: "Castro",
      distance: "0.6 mi",
      walkTime: "12 min walk",
    },
    attendees: [
      { name: "Sam", avatar: "S", color: "bg-stone-800" },
      { name: "K", avatar: "K", color: "bg-stone-300" },
    ],
    going: 4,
    position: { lat: 37.7825, lng: -122.4324 },
  },
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
