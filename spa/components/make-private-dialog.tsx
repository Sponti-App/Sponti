"use client"

import { Lock } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"

/**
 * Shown before a public flare is made private when people joined it without an
 * invite. They keep their spot; everyone who hasn't joined stops seeing it.
 */
export function MakePrivateDialog({
  joiners,
  busy,
  onConfirm,
  onClose,
}: {
  joiners: number
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      icon={<Lock className="h-4 w-4" />}
      title="make this flare private?"
      subtitle={`${joiners} ${joiners === 1 ? "person joined" : "people joined"} without an invite`}
      body="they'll stay on the guest list. anyone who hasn't joined won't be able to find it anymore."
      cancelLabel="keep it public"
      confirmLabel="make private"
      busyLabel="saving..."
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
