"use client"

import Link from "next/link"
import { menuItems } from "@/components/menu-items"
import { MenuProfile } from "@/components/menu-profile"

export function MenuDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <div
      aria-hidden={!open}
      className={`absolute inset-0 z-50 transition-opacity duration-200 ${
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        className="absolute inset-0 bg-foreground/25"
        onClick={onClose}
      />

      <aside
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex w-[82%] flex-col rounded-r-[32px] border-r border-border bg-background px-6 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pt-16">
          <MenuProfile />
        </div>

        <div className="h-px bg-border" />

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-6">
          {menuItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-1 py-3 text-base font-medium transition-colors hover:bg-secondary"
                tabIndex={open ? 0 : -1}
                onClick={onClose}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}
