"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Bottom confirm card used for the host actions that affect other people
 * (removing a guest, making a flare private). Same look as the cancel-flare
 * dialog, but fixed to the viewport so it works from anywhere on the page.
 */
export function ConfirmDialog({
  icon,
  title,
  subtitle,
  body,
  cancelLabel,
  confirmLabel,
  busyLabel,
  busy,
  onConfirm,
  onClose,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  body: string
  cancelLabel: string
  confirmLabel: string
  busyLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative flex w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              {icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="px-4 pb-3 text-xs text-muted-foreground">{body}</p>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-full"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            className="text-destructive-foreground flex-1 rounded-full bg-destructive hover:bg-destructive/90"
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
