import Link from "next/link"
import { menuItems } from "@/components/menu-items"
import { MenuPageShell } from "@/components/menu-page-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function MenuPage() {
  return (
    <MenuPageShell title="Menu" backHref="/" backLabel="Back to home">
      <div className="flex flex-col">
        <section className="pb-6">
          <Avatar className="size-16 border border-border">
            <AvatarImage
              src="/martin-profilepic-dev.jpg"
              alt="Martin Lindholm"
            />
            <AvatarFallback className="bg-secondary text-lg font-medium">
              ML
            </AvatarFallback>
          </Avatar>
          <div className="mt-4">
            <p className="text-2xl font-semibold">Martin Lindholm</p>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Sponti MVP tester
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Piteå, Sweden</p>
          </div>
        </section>

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
