"use client"

import { Home, User, Settings, QrCode, Sparkles } from "lucide-react"

const navItems = [
  { icon: QrCode, label: "QR" },
  { icon: Sparkles, label: "Host" },
  { icon: Home, label: "Home", active: true },
  { icon: User, label: "Profile" },
  { icon: Settings, label: "Settings" },
]

export function BottomNav() {
  return (
    <div className="flex justify-center pb-2 px-4">
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border rounded-full shadow-sm">
        {navItems.map((item, i) => (
          <button
            key={i}
            className={`flex items-center justify-center p-2.5 rounded-full transition-colors ${
              item.active ? "bg-brand text-brand-foreground" : "text-foreground"
            }`}
            aria-label={item.label}
          >
            <item.icon className="h-5 w-5" />
          </button>
        ))}
      </div>
    </div>
  )
}
