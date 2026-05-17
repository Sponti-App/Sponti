"use client"

import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import { Check, Loader2, RefreshCw, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createQrContactToken } from "@/lib/api/qr-contact-tokens"

export function QrShareSheet({
  displayName,
  handle,
  onClose,
}: {
  displayName: string
  handle: string
  onClose: () => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)

  const expiresLabel = useMemo(() => {
    if (!expiresAt) return null
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(expiresAt))
  }, [expiresAt])

  useEffect(() => {
    const controller = new AbortController()

    async function loadQr() {
      try {
        setError(null)
        const token = await createQrContactToken(controller.signal)
        const url = `${window.location.origin}/qr/${encodeURIComponent(token.token)}`
        const dataUrl = await QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          color: {
            dark: "#171717",
            light: "#ffffff",
          },
        })
        if (controller.signal.aborted) return
        setShareUrl(url)
        setQrDataUrl(dataUrl)
        setExpiresAt(token.expiresAt)
      } catch {
        if (!controller.signal.aborted) {
          setError("QR is unavailable right now.")
        }
      } finally {
        if (!controller.signal.aborted) {
          setRefreshing(false)
        }
      }
    }

    loadQr()

    return () => controller.abort()
  }, [refreshCount])

  const shareQr = async () => {
    if (!shareUrl) return
    const text = `Add ${displayName} on Sponti: ${shareUrl}`

    try {
      if (navigator.share) {
        await navigator.share({ title: "Add me on Sponti", text, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }
    } catch {
      // Share cancellation should not surface as an error.
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      <button
        type="button"
        aria-label="Close QR"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative mt-auto bg-card rounded-t-3xl border-t border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[11px] tracking-wide uppercase text-muted-foreground">
            your qr
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-2 pb-6 flex flex-col items-center gap-4">
          <div className="text-xl font-semibold">{displayName}</div>
          <div className="text-sm font-medium text-accent">@{handle}</div>

          <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-border bg-background p-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code for @${handle}`}
                className="h-full w-full"
              />
            ) : error ? (
              <p className="max-w-36 text-center text-sm text-muted-foreground">
                {error}
              </p>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-[260px]">
            scan to preview my profile and send a friend request
            {expiresLabel ? ` before ${expiresLabel}.` : "."}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={shareQr}
              disabled={!shareUrl || refreshing}
              className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 px-5 disabled:opacity-60"
            >
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              {copied ? "copied link" : "share QR link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true)
                setRefreshCount((count) => count + 1)
              }}
              className="rounded-full px-5"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              refresh
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
