"use client"

import { Info, Users, HelpCircle, LifeBuoy, Lock, X, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const menuItems = [
  { icon: Info, label: "About Sponti" },
  { icon: Users, label: "Friend Lists" },
  { icon: HelpCircle, label: "FAQ" },
  { icon: LifeBuoy, label: "Support" },
  { icon: Lock, label: "Privacy" },
]

export function SideDrawer({
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
        className={`absolute inset-0 z-40 bg-foreground/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`absolute top-0 bottom-0 left-0 z-50 w-[280px] bg-background border-r border-border flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header with profile */}
        <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-foreground">
              <AvatarFallback className="bg-background text-base font-medium">M</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">Me</p>
              <p className="text-xs text-muted-foreground">View profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground">Sponti · v1.0.0</p>
        </div>
      </aside>
    </>
  )
}
