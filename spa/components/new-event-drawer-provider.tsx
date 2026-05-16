"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { NewEventDrawer } from "@/components/new-event-drawer"

type NewEventDrawerContextValue = {
  open: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

const NewEventDrawerContext = createContext<NewEventDrawerContextValue | null>(
  null,
)

export function NewEventDrawerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const openDrawer = useCallback(() => setOpen(true), [])
  const closeDrawer = useCallback(() => setOpen(false), [])

  return (
    <NewEventDrawerContext.Provider value={{ open, openDrawer, closeDrawer }}>
      {children}
      <NewEventDrawer open={open} onClose={closeDrawer} />
    </NewEventDrawerContext.Provider>
  )
}

export function useNewEventDrawer(): NewEventDrawerContextValue {
  const ctx = useContext(NewEventDrawerContext)
  if (!ctx) {
    throw new Error(
      "useNewEventDrawer must be used inside <NewEventDrawerProvider>",
    )
  }
  return ctx
}
