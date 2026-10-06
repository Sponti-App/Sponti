"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CircleNotchIcon, FlameIcon } from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { buttonVariants } from "@/components/ui/button"
import { fetchContactPreviewName } from "@/lib/api/contact-preview"
import {
  buildRegisterPath,
  contactPath,
  type ContactLinkKind,
} from "@/lib/contact-links"
import { buildLoginPath } from "@/lib/redirect-path"
import { warmBackends } from "@/lib/http"
import { cn } from "@/lib/utils"

// #441: someone opens a friend's QR code or invite link without a session.
// That is as likely to be a person with an account (the phone camera opens
// Safari, where they never signed in) as a new one, so lead with who wants to
// connect and offer sign in and create account as two equal choices. Both
// keep the way back to the link. Same screen for both kinds of link.

// Same weight on purpose: neither choice is the "default" one, and the brand
// keeps to one accent CTA per screen.
const choiceClass = cn(
  buttonVariants({ variant: "outline" }),
  "h-[52px] w-full rounded-full text-base"
)

export function ContactLinkSignedOut({
  kind,
  token,
}: {
  kind: ContactLinkKind
  token: string
}) {
  const [preview, setPreview] = useState<{
    token: string
    name: string | null
  } | null>(null)
  const path = contactPath(kind, token)

  // #212: start waking the backends while they read the screen; the next
  // thing they do is sign in or register.
  useEffect(() => {
    warmBackends()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchContactPreviewName(kind, token, controller.signal)
      .then((name) => {
        if (!controller.signal.aborted) setPreview({ token, name })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [kind, token])

  const settled = preview?.token === token
  const name = settled ? preview.name : null

  return (
    <main className="flex min-h-dvh w-full flex-col bg-background px-6 pt-8 pb-8 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
            <FlameIcon className="size-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-normal">sponti</span>
        </div>

        <section
          className="flex flex-1 flex-col items-center justify-center text-center"
          aria-live="polite"
        >
          {!settled ? (
            <CircleNotchIcon
              className="size-7 animate-spin text-muted-foreground"
              aria-label="loading"
            />
          ) : (
            <>
              {name && (
                <div
                  aria-hidden="true"
                  className="mb-5 flex size-20 items-center justify-center rounded-full bg-secondary text-lg font-semibold"
                >
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <h1 className="max-w-xs text-lg font-semibold">
                {name
                  ? `${name} wants to connect on sponti`
                  : "a friend wants to connect on sponti"}
              </h1>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {name
                  ? "sign in or create an account to say yes."
                  : "sign in or create an account to open this link."}
              </p>
            </>
          )}
        </section>

        <div className="flex flex-col gap-3">
          <Link href={buildLoginPath(path)} className={choiceClass}>
            sign in
          </Link>
          <Link href={buildRegisterPath(path)} className={choiceClass}>
            create account
          </Link>
        </div>

        <LegalLinks className="mt-6" />
      </div>
    </main>
  )
}
