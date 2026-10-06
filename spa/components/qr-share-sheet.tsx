"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import {
  CheckIcon,
  CircleNotchIcon,
  ArrowCounterClockwiseIcon,
  ShareNetworkIcon,
  XIcon,
} from "@/components/icons"
import { useActionFeedback } from "@/components/action-feedback"
import { Button } from "@/components/ui/button"
import { getMyInviteLink, resetMyInviteLink } from "@/lib/api/invite-links"
import { createQrContactToken } from "@/lib/api/qr-contact-tokens"
import { buildContactUrl } from "@/lib/contact-links"

// #124: two ways to add you, with different trust levels.
//   - The QR code is a 15-minute token: someone scanning it in person is
//     connected with you straight away. It is re-issued before it expires
//     while the sheet stays open.
//   - "share sponti link" shares your 7-day invite link for group chats;
//     opening it only sends you a request. "reset link" revokes it.

// Re-issue the QR this long before it expires, so a scan never lands on a
// code that died while the sheet was open.
const QR_REFRESH_MARGIN_MS = 60_000
const MIN_QR_REFRESH_MS = 30_000

function errorProperty(error: unknown, key: "message" | "name"): string {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return ""
  }

  const value = (error as Record<typeof key, unknown>)[key]
  return typeof value === "string" ? value : ""
}

function isShareCancellation(error: unknown): boolean {
  const name = errorProperty(error, "name")
  const message = errorProperty(error, "message")

  if (/\bno share targets?\b/i.test(message)) {
    return false
  }

  return name === "AbortError" || /\b(cancelled|canceled)\b/i.test(message)
}

export function QrShareSheet({
  displayName,
  handle,
  onClose,
  heading = "your qr",
  closeLabel,
  onShared,
}: {
  displayName: string
  handle: string
  onClose: () => void
  /** The small label at the top. */
  heading?: string
  /** A text button ("later", #459's first-friend step) in place of the X. */
  closeLabel?: string
  /** After the invite link was shared or copied. */
  onShared?: () => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [qrRefreshTick, setQrRefreshTick] = useState(0)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState(false)
  const { showActionFeedback } = useActionFeedback()

  useEffect(() => {
    const controller = new AbortController()
    let refreshTimer: number | undefined

    async function loadQr() {
      try {
        const qrToken = await createQrContactToken(controller.signal)
        const url = buildContactUrl("qr", qrToken.token)
        if (!url) throw new Error("no public origin for qr links")
        const dataUrl = await QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          color: {
            dark: "#171717",
            light: "#ffffff",
          },
        })
        if (controller.signal.aborted) return
        setQrError(null)
        setQrDataUrl(dataUrl)
        refreshTimer = window.setTimeout(
          () => setQrRefreshTick((tick) => tick + 1),
          Math.max(
            MIN_QR_REFRESH_MS,
            qrToken.expiresInSeconds * 1000 - QR_REFRESH_MARGIN_MS
          )
        )
      } catch {
        if (!controller.signal.aborted) {
          setQrDataUrl(null)
          setQrError("qr is unavailable right now.")
        }
      }
    }

    loadQr()

    return () => {
      controller.abort()
      window.clearTimeout(refreshTimer)
    }
  }, [qrRefreshTick])

  useEffect(() => {
    const controller = new AbortController()

    getMyInviteLink(controller.signal)
      .then((link) => {
        if (controller.signal.aborted) return
        setInviteUrl(buildContactUrl("invite", link.token))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setInviteUrl(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setInviteLoading(false)
      })

    return () => controller.abort()
  }, [])

  const shareInvite = async () => {
    if (!inviteUrl) return
    const text = `add me on sponti: ${inviteUrl}`
    const canNativeShare = typeof navigator.share === "function"

    try {
      if (canNativeShare) {
        await navigator.share({
          title: "add me on sponti",
          text,
          url: inviteUrl,
        })
        showActionFeedback("link shared")
        onShared?.()
      } else {
        await navigator.clipboard.writeText(inviteUrl)
        setCopied(true)
        showActionFeedback("link copied")
        window.setTimeout(() => setCopied(false), 1600)
        onShared?.()
      }
    } catch (error) {
      // Share cancellation should not surface as an error.
      if (canNativeShare) {
        if (!isShareCancellation(error)) {
          showActionFeedback("couldn't share link", { tone: "error" })
        }
      } else {
        showActionFeedback("couldn't copy link", { tone: "error" })
      }
    }
  }

  const resetInvite = async () => {
    setResetting(true)
    try {
      const link = await resetMyInviteLink()
      setInviteUrl(buildContactUrl("invite", link.token))
      showActionFeedback("new link ready. the old one no longer works.")
    } catch {
      showActionFeedback("couldn't reset link", { tone: "error" })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <button
        type="button"
        aria-label="Close QR"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative mt-auto flex flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs text-muted-foreground">{heading}</span>
          {closeLabel ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {closeLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 px-6 pt-2 pb-6">
          <div className="text-lg font-semibold">{displayName}</div>
          <div className="text-sm font-medium text-accent">@{handle}</div>

          <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-border bg-background p-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code for @${handle}`}
                className="h-full w-full"
              />
            ) : qrError ? (
              <p className="max-w-36 text-center text-sm text-muted-foreground">
                {qrError}
              </p>
            ) : (
              <CircleNotchIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>

          <p className="max-w-[260px] text-center text-xs text-muted-foreground">
            scan in person to be friends right away. the code refreshes every 15
            min.
          </p>

          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={shareInvite}
              disabled={!inviteUrl || inviteLoading || resetting}
              className="rounded-full bg-accent px-5 text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
            >
              {copied ? (
                <CheckIcon className="mr-2 h-4 w-4" />
              ) : (
                <ShareNetworkIcon className="mr-2 h-4 w-4" />
              )}
              {copied ? "copied link" : "share sponti link"}
            </Button>
            <p className="max-w-[260px] text-center text-xs text-muted-foreground">
              for group chats. works for 7 days and sends you a friend request.
            </p>
            <button
              type="button"
              onClick={resetInvite}
              disabled={inviteLoading || resetting}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {resetting ? (
                <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" />
              )}
              reset link
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
