"use client"

import { createContext, useCallback, useContext, useState } from "react"
import {
  NewEventDrawer,
  normalizePrefill,
  type ComposerPrefill,
} from "@/components/new-event-drawer"

type NewEventDrawerContextValue = {
  open: boolean
  // With a prefill the composer opens with those fields filled in, unless the
  // person has an unsent draft of their own, which is kept as it was. Without
  // a prefill it opens as it was left.
  openDrawer: (prefill?: ComposerPrefill) => void
  closeDrawer: () => void
}

const NewEventDrawerContext = createContext<NewEventDrawerContextValue | null>(
  null
)

export function NewEventDrawerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null)
  const openDrawer = useCallback((next?: ComposerPrefill) => {
    setPrefill(normalizePrefill(next))
    setOpen(true)
  }, [])
  const closeDrawer = useCallback(() => setOpen(false), [])

  return (
    <NewEventDrawerContext.Provider value={{ open, openDrawer, closeDrawer }}>
      {children}
      <NewEventDrawer open={open} onClose={closeDrawer} prefill={prefill} />
    </NewEventDrawerContext.Provider>
  )
}

export function useNewEventDrawer(): NewEventDrawerContextValue {
  const ctx = useContext(NewEventDrawerContext)
  if (!ctx) {
    throw new Error(
      "useNewEventDrawer must be used inside <NewEventDrawerProvider>"
    )
  }
  return ctx
}
