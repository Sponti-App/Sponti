"use client"

import { UserMinus } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"

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
    <ConfirmDialog
      icon={<UserMinus className="h-4 w-4" />}
      title={`remove ${name}?`}
      subtitle="they said they're going"
      body="they'll be told they're no longer on the guest list, and the flare will disappear for them. you can invite them again later."
      cancelLabel="keep them"
      confirmLabel="remove"
      busyLabel="removing..."
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
