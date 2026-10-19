"use client"

import { useState } from "react"
import { CaretRightIcon } from "@/components/icons"
import { FeedbackSheet } from "@/components/feedback-sheet"

// A row that opens the feedback sheet, styled like the link rows beside it
// (the faq page's, a server component).
export function FeedbackButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-between rounded-xl border border-border px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary"
      >
        <span>{label}</span>
        <CaretRightIcon
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
      <FeedbackSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
