"use client"

import { MenuContents } from "@/components/menu-contents"

// #369: the home drawer holds profile and settings too (menu B of the #480
// prototype). /menu is the same contents as a page.

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
        {/* Bottom padding clears the nav, which sits over the drawer, so the
            legal row at the foot stays visible. */}
        <div className="flex min-h-0 flex-1 flex-col pt-16 pb-[var(--sponti-nav-h,4.5rem)]">
          <MenuContents tabIndex={open ? 0 : -1} onNavigate={onClose} />
        </div>
      </aside>
    </div>
  )
}
