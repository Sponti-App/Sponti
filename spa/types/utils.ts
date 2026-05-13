import { type EventType } from "@/lib/api/events"
import { Dumbbell, Users, UtensilsCrossed, Wine } from "lucide-react"

export const EVENT_TYPES: {
  value: EventType
  label: string
  icon: typeof UtensilsCrossed
}[] = [
  { value: "food", label: "food", icon: UtensilsCrossed },
  { value: "drinks", label: "drinks", icon: Wine },
  { value: "sports", label: "sports", icon: Dumbbell },
  { value: "hangout", label: "hang out", icon: Users },
]
