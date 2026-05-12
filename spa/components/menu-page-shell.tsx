import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"

export function MenuPageShell({
  title,
  backHref = "/menu",
  backLabel = "Back to menu",
  children,
}: {
  title: string
  backHref?: string
  backLabel?: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background">
        <header className="flex items-center justify-between px-4 pt-3 pb-5">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="h-9 w-9" />
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-4">{children}</main>

        <BottomNav />
    </div>
  )
}
