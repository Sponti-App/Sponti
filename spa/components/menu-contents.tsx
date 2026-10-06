"use client"

import Link from "next/link"
import { GearIcon, type Icon } from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { menuItems } from "@/components/menu-items"
import { MenuProfile } from "@/components/menu-profile"
import { cn } from "@/lib/utils"

// #369: what the menu holds, shared by the home drawer (MenuDrawer) and the
// /menu fallback page. The profile card (→ edit profile), a settings row,
// about / faq / support, and the legal pages as the quiet
// "impressum · privacy · terms" row at the foot.

const LEGAL_HREFS = new Set<string>([
  "/menu/privacy",
  "/menu/terms",
  "/menu/impressum",
])
const rows = menuItems.filter((item) => !LEGAL_HREFS.has(item.href))

function MenuRow({
  href,
  icon: Icon,
  label,
  sub,
  tabIndex,
  onNavigate,
}: {
  href: string
  icon: Icon
  label: string
  sub?: string
  tabIndex?: number
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      tabIndex={tabIndex}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-muted active:bg-muted"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{label}</span>
        {sub && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
    </Link>
  )
}

export function MenuContents({
  tabIndex,
  onNavigate,
  className,
}: {
  /** -1 while the drawer is closed, so its links aren't focusable. */
  tabIndex?: number
  /** Called on any link tap (the drawer closes itself). */
  onNavigate?: () => void
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <MenuProfile tabIndex={tabIndex} onNavigate={onNavigate} />

      <nav aria-label="account" className="mt-4 flex flex-col gap-1">
        <MenuRow
          href="/settings"
          icon={GearIcon}
          label="settings"
          sub="privacy, notifications and password"
          tabIndex={tabIndex}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="mt-4 h-px bg-border" />

      <nav
        aria-label="about"
        className="flex flex-1 flex-col gap-1 overflow-y-auto py-4"
      >
        {rows.map((item) => (
          <MenuRow
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            tabIndex={tabIndex}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <LegalLinks className="-mx-2 justify-start pb-4" tabIndex={tabIndex} />
    </div>
  )
}
