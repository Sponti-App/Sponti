"use client"

import { useState } from "react"
import { TrashIcon, XIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteAccount } from "@/lib/api/auth"
import { HttpError } from "@/lib/http"

/**
 * Deleting your own account (#449). Same bottom card as ConfirmDialog, with
 * the confirmation field: the password, or the @username for a Google-only
 * account. There is no undo, so the button stays off until something is typed.
 */
export function DeleteAccountDialog({
  username,
  hasPassword,
  onDeleted,
  onClose,
}: {
  username: string
  hasPassword: boolean
  onDeleted: () => void
  onClose: () => void
}) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount(
        hasPassword ? { password: value } : { confirmUsername: value }
      )
      onDeleted()
    } catch (err) {
      setError(
        err instanceof HttpError && err.status === 403
          ? err.message
          : "couldn't delete your account. try again"
      )
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="delete your account"
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
    >
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        disabled={busy}
        className="absolute inset-0 bg-foreground/30"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim() && !busy) void submit()
        }}
        className="relative flex w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TrashIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">delete your account?</p>
              <p className="text-xs text-muted-foreground">
                this can&apos;t be undone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="close"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          your profile, flares, friends and circles are erased. guests of your
          upcoming flares get a cancellation notice.
        </p>
        <div className="px-4 pb-3">
          <Input
            type={hasPassword ? "password" : "text"}
            autoComplete={hasPassword ? "current-password" : "off"}
            autoCapitalize="none"
            aria-label={hasPassword ? "your password" : "your @username"}
            placeholder={
              hasPassword ? "your password" : `type @${username} to confirm`
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
          />
          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-full"
          >
            keep my account
          </Button>
          <Button
            type="submit"
            disabled={busy || !value.trim()}
            className="text-destructive-foreground flex-1 rounded-full bg-destructive hover:bg-destructive/90"
          >
            {busy ? "deleting…" : "delete"}
          </Button>
        </div>
      </form>
    </div>
  )
}
