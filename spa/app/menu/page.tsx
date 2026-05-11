import Link from "next/link"
import { menuItems } from "@/components/menu-items"
import { MenuProfile } from "@/components/menu-profile"
import { MenuPageShell } from "@/components/menu-page-shell"

export default function MenuPage() {
  return (
    <MenuPageShell title="Menu" backHref="/" backLabel="Back to home">
      <div className="flex flex-col">
        <MenuProfile />

        <div className="h-px bg-border" />

        <nav className="flex flex-col gap-1 py-6">
          {menuItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-1 py-3 text-base font-medium transition-colors hover:bg-secondary"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </MenuPageShell>
  )
}
