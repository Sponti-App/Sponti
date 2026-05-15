"use client"

import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { HostedEvent, EventStatus } from "@/lib/api/events"

export function CancelEventDialog({
  event,
  status,
  onConfirm,
  onClose,
}: {
  event: HostedEvent
  status: EventStatus
  onConfirm: () => void
  onClose: () => void
}) {
  const goingCount = event.attendingCount
  const inviteCount = event.attendeeCount
  const isLive = status === "live"

  const headline = isLive
    ? `${goingCount > 0 ? `${goingCount} ${goingCount === 1 ? "friend is" : "friends are"} on their way` : "this flare is live"}`
    : goingCount > 0
      ? `${goingCount} of ${inviteCount} ${goingCount === 1 ? "is going" : "are going"}`
      : inviteCount > 0
        ? `${inviteCount} ${inviteCount === 1 ? "person is invited" : "people are invited"}`
        : "no one's been notified yet"

  const body = isLive
    ? "cancelling now sends a 'cancelled' notification, even to anyone already in transit."
    : inviteCount > 0
      ? "they'll get notified, and you can undo for a few seconds after."
      : "no notifications will fire."

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center px-4 pb-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative flex w-full flex-col rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">cancel {event.title}?</p>
              <p className="text-xs text-muted-foreground">{headline}</p>
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
            className="flex-1 rounded-full"
          >
            keep it
          </Button>
          <Button
            onClick={onConfirm}
            className="text-destructive-foreground flex-1 rounded-full bg-destructive hover:bg-destructive/90"
          >
            cancel event
          </Button>
        </div>
      </div>
    </div>
  )
}
