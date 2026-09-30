"use client"

import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { readSession, subscribeSession } from "@/lib/auth-store"
import { hasInAppHistory } from "@/lib/in-app-history"

// Where back goes when the page was opened directly (no in-app history):
// signed in, the menu; signed out, registration. Signed-out visitors only
// reach the legal pages, and those are linked from /register ("by signing up
// you agree to the terms"), so that's where they most likely came from.
// /login doesn't link them.
const SIGNED_IN_FALLBACK = "/menu"
const SIGNED_OUT_FALLBACK = "/register"

// Reads the stored session the same way AuthProvider does (auth-store), rather
// than useAuth(), so the shell also renders where there's no provider (unit
// tests of the pages) and the legal pages stay readable signed out. False on
// the server and during hydration, so the markup is stable.
function useSignedIn(): boolean {
  return useSyncExternalStore(
    subscribeSession,
    () => {
      const { accessToken, refreshToken } = readSession()
      return Boolean(accessToken && refreshToken)
    },
    () => false
  )
}

export function MenuPageShell({
  title,
  backHref,
  backLabel = "back",
  children,
}: {
  title: string
  /**
   * A fixed destination for the back arrow. Leave unset for the default:
   * return to the previous page, or fall back to the menu / registration.
   */
  backHref?: string
  backLabel?: string
  children: ReactNode
}) {
  const signedIn = useSignedIn()

  const fallbackHref = signedIn ? SIGNED_IN_FALLBACK : SIGNED_OUT_FALLBACK
  const href = backHref ?? fallbackHref

  function handleBack(event: MouseEvent<HTMLAnchorElement>) {
    if (backHref) return
    // Let the browser handle open-in-new-tab and friends.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    if (!hasInAppHistory()) return

    event.preventDefault()
    // Next's app router listens for popstate, so this is a client transition
    // back to the previous page, same as the browser's own back button.
    window.history.back()
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between px-4 pt-3 pb-5">
        <Link
          href={href}
          onClick={handleBack}
          aria-label={backLabel}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="h-9 w-9" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-28">{children}</main>
    </div>
  )
}
