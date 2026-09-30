"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { markInAppNavigation } from "@/lib/in-app-history"

/** Mounted once in the root layout; renders nothing. See lib/in-app-history. */
export function InAppHistoryTracker() {
  const pathname = usePathname()
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname
      markInAppNavigation()
    }
  }, [pathname])

  return null
}
