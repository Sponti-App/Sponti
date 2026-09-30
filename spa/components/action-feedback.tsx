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

export type ActionFeedbackAction = {
  label: string
  onAction: () => void
}

type ActionFeedbackMessage = {
  id: number
  tone: ActionFeedbackTone
  message: string
  action?: ActionFeedbackAction
  durationMs: number
}

type ShowActionFeedbackOptions = {
  tone?: ActionFeedbackTone
  // An inline button on the toast, e.g. "undo" (#226). Tapping it runs the
  // action and closes the toast.
  action?: ActionFeedbackAction
  // How long the toast stays up. Defaults to DEFAULT_DURATION_MS.
  durationMs?: number
}

const DEFAULT_DURATION_MS = 2600

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
      setCurrent({
        id: nextId.current,
        tone,
        message,
        action: options.action,
        durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
      })
      void haptic(tone === "success" ? "success" : "error")
    },
    []
  )

  useEffect(() => {
    if (!current) return
    const timeout = window.setTimeout(
      () => setCurrent(null),
      current.durationMs
    )
    return () => window.clearTimeout(timeout)
  }, [current])

  const value = useMemo(
    () => ({ showActionFeedback }),
    [showActionFeedback]
  )

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      {/* Sits just above whatever is docked at the bottom of the screen: the
          bottom nav everywhere, or a sheet docked on it. The map view and the
          notifications sheet write --sponti-bottom-occupied (see map-view.tsx
          and notifications-sheet.tsx); everywhere else it falls back to
          --sponti-nav-h, which already includes the safe-area inset (#112). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sponti-bottom-occupied,var(--sponti-nav-h,64px))+12px)] z-[70] flex justify-center px-4">
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
            {current.action && (
              <button
                type="button"
                onClick={() => {
                  const { onAction } = current.action!
                  setCurrent(null)
                  onAction()
                }}
                // The toast container ignores pointer events so it never
                // blocks what's under it; the action button opts back in.
                className="pointer-events-auto -my-1 -mr-2 ml-1 flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-foreground underline underline-offset-2 hover:bg-muted"
              >
                {current.action.label}
              </button>
            )}
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

const noopActionFeedback: ActionFeedbackContextValue = {
  showActionFeedback: () => undefined,
}

/**
 * Like useActionFeedback, but a silent no-op outside the provider. For
 * leaf components that are also rendered on their own (in tests, or before
 * the app shell mounts).
 */
export function useOptionalActionFeedback(): ActionFeedbackContextValue {
  return useContext(ActionFeedbackContext) ?? noopActionFeedback
}
