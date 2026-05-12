"use client"

import { Home, User, Settings, Users, Sparkles } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

const navItems = [
  { icon: Users, label: "Circles", href: "/circles" },
  { icon: Sparkles, label: "Host", href: "/event" },
  { icon: Home, label: "Home", href: "/" },
  { icon: User, label: "Profile", href: "/profile" },
  { icon: Settings, label: "Settings", href: "/settings" },
] as const

export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (href: string | null) => {
    if (href === null) return false
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <div className="flex justify-center pb-2 px-4">
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border rounded-full shadow-sm">
        {navItems.map((item, i) => (
          <button
            key={i}
            onClick={() => item.href && router.push(item.href)}
            disabled={item.href === null}
            className={`flex items-center justify-center p-2.5 rounded-full transition-colors ${
              isActive(item.href) ? "bg-accent text-accent-foreground" : "text-foreground"
            } ${item.href === null ? "opacity-40" : ""}`}
            aria-label={item.label}
          >
            <item.icon className="h-5 w-5" />
          </button>
        ))}
      </div>
    </div>
  )
}
