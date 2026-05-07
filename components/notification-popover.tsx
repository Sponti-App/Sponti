"use client"

import { Coffee, UserPlus, Check } from "lucide-react"

const notifications = [
  {
    id: 1,
    icon: Coffee,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    title: "coffee w/ Mira",
    subtitle: "starts in 30 min",
    time: "now",
  },
  {
    id: 2,
    icon: UserPlus,
    iconBg: "bg-stone-100",
    iconColor: "text-stone-700",
    title: "Lin wants to meet up",
    subtitle: "tap to respond",
    time: "5m",
  },
  {
    id: 3,
    icon: Check,
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
    title: "Maria confirmed",
    subtitle: "she's coming to your patio hang",
    time: "1h",
  },
]

export function NotificationsPopover({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover */}
      <div
        className={`absolute top-[88px] right-3 z-50 w-[320px] bg-background border border-border rounded-2xl shadow-lg overflow-hidden transition-all duration-200 origin-top-right ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-medium text-sm">Notifications</h3>
          <span className="text-xs text-muted-foreground">{notifications.length} new</span>
        </div>

        {/* List */}
        <ul className="divide-y divide-border max-h-[360px] overflow-y-auto">
          {notifications.map((n) => (
            <li key={n.id}>
              <button className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors text-left">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${n.iconBg}`}
                >
                  <n.icon className={`h-4 w-4 ${n.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.subtitle}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{n.time}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <button className="w-full px-4 py-3 text-sm font-medium border-t border-border hover:bg-muted transition-colors">
          View all
        </button>
      </div>
    </>
  )
}
