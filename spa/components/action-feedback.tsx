"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AlertCircle, Check } from "lucide-react"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

type ActionFeedbackTone = "success" | "error"

type ActionFeedbackMessage = {
  id: number
  tone: ActionFeedbackTone
  message: string
}

type ShowActionFeedbackOptions = {
  tone?: ActionFeedbackTone
}

type ActionFeedbackContextValue = {
  showActionFeedback: (
    message: string,
    options?: ShowActionFeedbackOptions
  ) => void
}

const ActionFeedbackContext = createContext<ActionFeedbackContextValue | null>(
  null
)

export function ActionFeedbackProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [current, setCurrent] = useState<ActionFeedbackMessage | null>(null)
  const nextId = useRef(0)

  const showActionFeedback = useCallback(
    (message: string, options: ShowActionFeedbackOptions = {}) => {
      const tone = options.tone ?? "success"
      nextId.current += 1
      setCurrent({ id: nextId.current, tone, message })
      void haptic(tone === "success" ? "success" : "error")
    },
    []
  )

  useEffect(() => {
    if (!current) return
    const timeout = window.setTimeout(() => setCurrent(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [current])

  const value = useMemo(
    () => ({ showActionFeedback }),
    [showActionFeedback]
  )

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_5.75rem)] z-[70] flex justify-center px-4">
        {current && (
          <div
            key={current.id}
            role={current.tone === "error" ? "alert" : "status"}
            aria-live={current.tone === "error" ? "assertive" : "polite"}
            className={cn(
              "flex max-w-[min(22rem,100%)] items-center gap-2 rounded-full border px-3 py-2 pr-4 text-sm font-medium shadow-md backdrop-blur-md",
              "animate-in duration-150 fade-in-0 slide-in-from-bottom-2",
              current.tone === "success"
                ? "border-accent/40 bg-card/95 text-foreground"
                : "border-destructive/40 bg-card/95 text-destructive"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                current.tone === "success"
                  ? "bg-accent text-accent-foreground"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {current.tone === "success" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="truncate">{current.message}</span>
          </div>
        )}
      </div>
    </ActionFeedbackContext.Provider>
  )
}

export function useActionFeedback(): ActionFeedbackContextValue {
  const context = useContext(ActionFeedbackContext)
  if (!context) {
    throw new Error(
      "useActionFeedback must be used inside <ActionFeedbackProvider>"
    )
  }
  return context
}
