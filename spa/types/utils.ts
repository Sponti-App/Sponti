import { type EventType } from "@/lib/api/events"
import {
  Dumbbell,
  Landmark,
  Palette,
  PartyPopper,
  Users,
  UtensilsCrossed,
  Wine,
} from "lucide-react"

export const EVENT_TYPES: {
  value: EventType
  label: string
  icon: typeof UtensilsCrossed
}[] = [
  { value: "hangout", label: "hang out", icon: Users },
  { value: "drinks", label: "drinks", icon: Wine },
  { value: "food", label: "food", icon: UtensilsCrossed },
  { value: "party", label: "party", icon: PartyPopper },
  { value: "sports", label: "sports", icon: Dumbbell },
  { value: "culture", label: "culture", icon: Landmark },
  { value: "hobby", label: "hobby", icon: Palette },
]
