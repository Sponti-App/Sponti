"use client"

import { UserMinus, X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Confirm step for removing a guest who already said they're going. Guests who
 * are only invited (or declined) are removed without asking, so this is the one
 * place we slow the host down.
 */
export function RemoveGuestDialog({
  name,
  busy,
  onConfirm,
  onClose,
}: {
  name: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`remove ${name}?`}
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
              <UserMinus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">remove {name}?</p>
              <p className="text-xs text-muted-foreground">
                they said they&apos;re going
              </p>
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
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          they&apos;ll be told they&apos;re no longer on the guest list, and the
          flare will disappear for them. you can invite them again later.
        </p>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-full"
          >
            keep them
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            className="text-destructive-foreground flex-1 rounded-full bg-destructive hover:bg-destructive/90"
          >
            {busy ? "removing..." : "remove"}
          </Button>
        </div>
      </div>
    </div>
  )
}
