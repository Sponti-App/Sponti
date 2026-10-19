"use client"

// In-app feedback for testers: a bug, something confusing or an idea, in one
// sheet. It replaces the old route of menu → faq & feedback → support → a Mail
// draft. The message is mailed by the auth-server (POST /auth/feedback) with
// the tester as reply-to; the screen, build and device are added here so a bug
// report arrives with what we'd otherwise have to ask for.

import { useState } from "react"
import Link from "next/link"
import { Drawer } from "vaul"
import { useActionFeedback } from "@/components/action-feedback"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { sendFeedback, type FeedbackKind } from "@/lib/api/auth"
import { haptic } from "@/lib/haptics"
import { describeBuild, describeDevice } from "@/lib/support-mail"
import { cn } from "@/lib/utils"

const MESSAGE_MAX_LENGTH = 2000

const KINDS: { value: FeedbackKind; label: string; placeholder: string }[] = [
  {
    value: "bug",
    label: "bug",
    placeholder: "what happened, and what did you expect?",
  },
  {
    value: "confusing",
    label: "confusing",
    placeholder: "what was hard to figure out?",
  },
  {
    value: "idea",
    label: "idea",
    placeholder: "what would make meeting up easier?",
  },
]

export function FeedbackSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { showActionFeedback } = useActionFeedback()
  const [kind, setKind] = useState<FeedbackKind>("bug")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = message.trim()
  const canSend = trimmed.length >= 3 && !sending
  const placeholder = KINDS.find((item) => item.value === kind)?.placeholder

  const submit = async () => {
    if (!canSend) return
    haptic("medium")
    setSending(true)
    setError(null)
    try {
      await sendFeedback({
        kind,
        message: trimmed,
        page: window.location.pathname,
        build: describeBuild(),
        device: describeDevice(),
      })
      setMessage("")
      onClose()
      showActionFeedback("thanks, we got it")
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "couldn't send that. try again"
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          haptic("light")
          onClose()
        }
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Drawer.Content
          aria-label="send feedback"
          data-sheet="send feedback"
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet) outline-none"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border" />
          <Drawer.Title className="text-base font-semibold">
            send feedback
          </Drawer.Title>
          <Drawer.Description className="mt-1 text-sm text-muted-foreground">
            it goes straight to us, with your screen and device attached.
          </Drawer.Description>

          <div
            role="radiogroup"
            aria-label="what kind of feedback"
            className="mt-4 flex rounded-full bg-muted p-1"
          >
            {KINDS.map(({ value, label }) => {
              const selected = kind === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    haptic("selection")
                    setKind(value)
                  }}
                  className={cn(
                    "h-9 flex-1 rounded-full text-sm font-medium active:scale-[0.97]",
                    selected
                      ? "bg-card font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <Textarea
            aria-label="your feedback"
            rows={4}
            value={message}
            maxLength={MESSAGE_MAX_LENGTH}
            disabled={sending}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setMessage(event.target.value)
              setError(null)
            }}
            className="mt-3 min-h-28 resize-none"
          />

          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button
            type="button"
            disabled={!canSend}
            onClick={() => void submit()}
            className="mt-4 h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
          >
            {sending ? "sending..." : "send"}
          </Button>
          <Link
            href="/menu/support"
            onClick={onClose}
            className="flex min-h-11 w-full items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            safety report or account help
          </Link>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
