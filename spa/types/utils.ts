import { type EventType } from "@/lib/api/events"
import {
  BarbellIcon,
  BankIcon,
  PaletteIcon,
  ConfettiIcon,
  UsersIcon,
  ForkKnifeIcon,
  WineIcon,
  type Icon,
} from "@/components/icons"

export const EVENT_TYPES: {
  value: EventType
  label: string
  icon: Icon
}[] = [
  { value: "hangout", label: "hang out", icon: UsersIcon },
  { value: "drinks", label: "drinks", icon: WineIcon },
  { value: "food", label: "food", icon: ForkKnifeIcon },
  { value: "party", label: "party", icon: ConfettiIcon },
  { value: "sports", label: "sports", icon: BarbellIcon },
  { value: "culture", label: "culture", icon: BankIcon },
  { value: "hobby", label: "hobby", icon: PaletteIcon },
]
