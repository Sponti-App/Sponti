"use client"

// "reset link" on a flare's edit page (#616): replaces the flare's invite link,
// so the one already sent to people stops working. It asks first, because it
// closes the door on anyone who has not opened the link yet. Nothing is fetched
// until they tap: the page doesn't need the link to show this row.

import { useState } from "react"
import { LinkIcon } from "@/components/icons"
import { useActionFeedback } from "@/components/action-feedback"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { resetEventInviteLink } from "@/lib/api/flare-invites"

export function FlareInviteLinkReset({ eventId }: { eventId: string }) {
  const { showActionFeedback } = useActionFeedback()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const reset = async () => {
    setBusy(true)
    try {
      await resetEventInviteLink(eventId)
      setConfirming(false)
      showActionFeedback("new link ready. the old one no longer works.")
    } catch {
      showActionFeedback("couldn't reset the link", { tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-flare-invite-link-reset
      className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">invite link</p>
        <p className="text-xs text-muted-foreground">
          resetting it stops the link you sent from working
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-full"
      >
        reset link
      </Button>

      {confirming && (
        <ConfirmDialog
          icon={<LinkIcon className="h-4 w-4" />}
          title="reset the invite link?"
          subtitle="the link you sent stops working"
          body="anyone who hasn't opened it yet will need a new one. people who already joined stay on the flare."
          cancelLabel="keep it"
          confirmLabel="reset link"
          busyLabel="resetting..."
          busy={busy}
          onConfirm={() => void reset()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
