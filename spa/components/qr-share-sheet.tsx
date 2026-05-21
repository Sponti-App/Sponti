"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Check, Loader2, Share2, X } from "lucide-react"
import { useActionFeedback } from "@/components/action-feedback"
import { Button } from "@/components/ui/button"

const DEFAULT_PUBLIC_APP_URL = "https://sponti.fun"

function publicAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_PUBLIC_APP_URL?.trim()
  return (configured || DEFAULT_PUBLIC_APP_URL).replace(/\/+$/, "")
}

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
}: {
  displayName: string
  handle: string
  onClose: () => void
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const { showActionFeedback } = useActionFeedback()

  useEffect(() => {
    let cancelled = false

    async function loadQr() {
      try {
        setError(null)
        const url = publicAppUrl()
        const dataUrl = await QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          color: {
            dark: "#171717",
            light: "#ffffff",
          },
        })
        if (cancelled) return
        setShareUrl(url)
        setQrDataUrl(dataUrl)
      } catch {
        if (!cancelled) {
          setError("qr is unavailable right now.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadQr()

    return () => {
      cancelled = true
    }
  }, [])

  const shareQr = async () => {
    if (!shareUrl) return
    const text = `open sponti: ${shareUrl}`
    const canNativeShare = typeof navigator.share === "function"

    try {
      if (canNativeShare) {
        await navigator.share({ title: "open sponti", text, url: shareUrl })
        showActionFeedback("link shared")
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        showActionFeedback("link copied")
        window.setTimeout(() => setCopied(false), 1600)
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

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      <button
        type="button"
        aria-label="Close QR"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative mt-auto flex flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
            your qr
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 pt-2 pb-6">
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

          <p className="max-w-[260px] text-center text-xs text-muted-foreground">
            scan to open sponti
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={shareQr}
              disabled={!shareUrl || loading}
              className="rounded-full bg-accent px-5 text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              {copied ? "copied link" : "share sponti link"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
