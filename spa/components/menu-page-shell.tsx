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
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="relative flex h-[844px] w-[390px] flex-col overflow-hidden rounded-[40px] border-[8px] border-foreground bg-background">
        <div className="flex items-center justify-between px-6 pt-3 pb-2">
          <span className="text-sm font-medium">9:41</span>
          <div className="h-[24px] w-[80px] rounded-full bg-foreground" />
          <div className="flex items-center gap-1">
            <span className="text-xs">•••</span>
            <span className="text-xs">◗</span>
            <span className="text-xs">▌</span>
          </div>
        </div>

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

        <div className="flex justify-center pt-1 pb-2">
          <div className="h-1 w-32 rounded-full bg-foreground" />
        </div>
      </div>
    </div>
  )
}
