"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import QRCode from "qrcode"
import {
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  ArrowCounterClockwiseIcon,
  ShareNetworkIcon,
  XIcon,
} from "@/components/icons"
import { useActionFeedback } from "@/components/action-feedback"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMyInviteLink, resetMyInviteLink } from "@/lib/api/invite-links"
import { createQrContactToken } from "@/lib/api/qr-contact-tokens"
import { buildContactUrl } from "@/lib/contact-links"

// #124: two ways to add you, with different trust levels.
//   - The QR code is a 15-minute token: someone scanning it in person is
//     connected with you straight away. It is re-issued before it expires
//     while the sheet stays open.
//   - The invite link is your 7-day link for group chats; opening it only
//     sends you a request. "reset link" revokes it.
// #369: the two are tabs, "invite link" and "qr code", opening on the link
// (most first invites go to someone who isn't next to you). The QR is still
// fetched and refreshed while the link tab shows, so switching is instant.
// Only the link tab has a peach button.

export type ShareTab = "link" | "qr"

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
  heading = "invite a friend",
  closeLabel,
  onShared,
  initialTab = "link",
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
  /** The tab it opens on. */
  initialTab?: ShareTab
}) {
  const [tab, setTab] = useState<ShareTab>(initialTab)
  const [linkCopied, setLinkCopied] = useState(false)
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

  const copyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setLinkCopied(true)
      showActionFeedback("link copied")
      window.setTimeout(() => setLinkCopied(false), 1600)
      onShared?.()
    } catch {
      showActionFeedback("couldn't copy link", { tone: "error" })
    }
  }

  const linkBusy = !inviteUrl || inviteLoading || resetting

  return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <button
        type="button"
        aria-label="Close QR"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      {/* Fits the visible viewport (#495): the overlay is the screen, so the
          sheet never grows past it, and its body scrolls on a short phone
          instead of pushing the code under the bottom edge. */}
      <div className="relative mt-auto flex max-h-full flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
          <span className="text-base font-semibold">{heading}</span>
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

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as ShareTab)}
          className="min-h-0 gap-0"
        >
          <div className="shrink-0 px-4">
            <TabsList className="h-9 w-full">
              <TabsTrigger value="link">invite link</TabsTrigger>
              <TabsTrigger value="qr">qr code</TabsTrigger>
            </TabsList>
          </div>

          {/* Both tabs hold the same height, so switching doesn't jump. */}
          <div className="flex min-h-0 min-h-[min(25.5rem,60dvh)] flex-col overflow-y-auto overscroll-contain px-6 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <TabsContent
              value="link"
              className="m-0 flex flex-1 flex-col"
              data-share-tab="link"
            >
              <p className="text-sm">
                send this to a friend or a group chat. whoever opens it can send
                you a friend request.
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background py-1 pr-1 pl-3">
                <span
                  data-invite-url
                  className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
                >
                  {inviteUrl
                    ? inviteUrl.replace(/^https?:\/\//, "")
                    : inviteLoading
                      ? "getting your link…"
                      : "the link is unavailable right now."}
                </span>
                <Button
                  variant="ghost"
                  onClick={copyInvite}
                  disabled={linkBusy}
                  aria-label={linkCopied ? "copied" : "copy link"}
                  className="h-9 rounded-lg px-3"
                >
                  {linkCopied ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                  {linkCopied ? "copied" : "copy"}
                </Button>
              </div>

              <Button
                onClick={shareInvite}
                disabled={linkBusy}
                className="mt-4 h-12 w-full rounded-full bg-accent text-base text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
              >
                {copied ? (
                  <CheckIcon className="mr-1 h-4 w-4" />
                ) : (
                  <ShareNetworkIcon className="mr-1 h-4 w-4" />
                )}
                {copied ? "copied link" : "share link"}
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                works for 7 days. you&apos;ll see each request before
                you&apos;re friends.
              </p>

              <button
                type="button"
                onClick={resetInvite}
                disabled={inviteLoading || resetting}
                className="mx-auto mt-2 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {resetting ? (
                  <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" />
                )}
                reset link
              </button>
            </TabsContent>

            <TabsContent
              value="qr"
              className="m-0 flex flex-col items-center gap-3"
              data-share-tab="qr"
            >
              <div className="text-center">
                <p className="text-base font-semibold">{displayName}</p>
                <p className="text-sm text-muted-foreground">@{handle}</p>
              </div>
              <div className="flex size-[min(15rem,36dvh)] shrink-0 items-center justify-center rounded-2xl border border-border bg-background p-4">
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
                for when you&apos;re together. they scan it and you&apos;re
                friends right away. the code refreshes every 15 min.
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

/**
 * #369: the sheet as its own dialog over the whole screen, above the nav, for
 * the home header's "invite" pill.
 */
export function InviteDialog({
  displayName,
  handle,
  onClose,
  initialTab,
}: {
  displayName: string
  handle: string
  onClose: () => void
  initialTab?: ShareTab
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="invite a friend"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose()
      }}
      className="fixed inset-0 z-[55]"
    >
      <QrShareSheet
        displayName={displayName}
        handle={handle}
        onClose={onClose}
        initialTab={initialTab}
      />
    </div>,
    document.body
  )
}
