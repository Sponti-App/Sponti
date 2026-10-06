"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { cn } from "@/lib/utils"

// #467: a QR code to open sponti on a phone. The mobile gate shows one of the
// page it covers; the landing page shows one of the app's url. Drawn on the
// client, so nothing is fetched for it.

export function PhoneQr({
  url,
  alt = "qr code of this page",
  className,
}: {
  /** What the code opens. Default: this page. A relative url resolves
   * against this page's origin. */
  url?: string
  alt?: string
  className?: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const target = url
      ? new URL(url, window.location.href).href
      : window.location.href
    QRCode.toDataURL(target, {
      width: 240,
      margin: 2,
      color: { dark: "#171717", light: "#ffffff" },
    })
      .then((next) => {
        if (!cancelled) setDataUrl(next)
      })
      .catch(() => {
        // No code: the heading and line next to it still say what to do.
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div
      className={cn(
        "flex size-60 items-center justify-center rounded-2xl border border-border bg-card p-4",
        className
      )}
    >
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={alt}
          className="h-full w-full rounded-lg"
          data-qr-target={url ?? undefined}
        />
      )}
    </div>
  )
}
