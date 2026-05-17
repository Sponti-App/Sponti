"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"

// Direct hits to /event/new open the drawer over the home page so the map is
// visible behind it. The drawer itself lives in the global provider — this
// route just triggers + redirects.
export default function NewEventRoute() {
  const router = useRouter()
  const { openDrawer } = useNewEventDrawer()

  useEffect(() => {
    openDrawer()
    router.replace("/")
  }, [openDrawer, router])

  return null
}
