"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import QRCode from "qrcode"
import { LEGAL_PATHS } from "@/components/auth-gate"
import { LegalLinks } from "@/components/legal-links"
import { Button } from "@/components/ui/button"
import {
  MOBILE_GATE_MODE,
  rememberContinueAnyway,
  useMobileGate,
} from "@/lib/mobile-gate"

// #467 part 2: the "sponti is made for your phone" notice. See lib/mobile-gate
// for the rule (desktop-sized, no touch) and the warn-or-block constant.
//
// The legal pages are never gated: the impressum has to be reachable from
// every page. They render straight away, with no waiting on the client.

function PhoneQr() {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(window.location.href, {
      width: 240,
      margin: 2,
      color: { dark: "#171717", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        // No code: the heading and line still say what to do.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-border bg-card p-4">
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="qr code of this page"
          className="h-full w-full rounded-lg"
        />
      )}
    </div>
  )
}

function MobileNotice() {
  return (
    <main
      data-mobile-gate="notice"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-semibold">sponti is made for your phone</h1>
        <p className="text-sm text-muted-foreground">
          scan this to open it there.
        </p>
      </div>
      <PhoneQr />
      {MOBILE_GATE_MODE === "warn" && (
        <Button
          variant="outline"
          onClick={rememberContinueAnyway}
          className="h-11 rounded-full px-5"
        >
          continue anyway
        </Button>
      )}
      <LegalLinks />
    </main>
  )
}

export function MobileGate({ children }: { children: React.ReactNode }) {
  const state = useMobileGate()
  const pathname = usePathname()

  if (LEGAL_PATHS.includes(pathname)) return <>{children}</>

  // Deciding: a plain background, so neither the app nor the notice flashes.
  if (state === "undecided") {
    return <div className="min-h-dvh bg-background" />
  }
  if (state === "notice") return <MobileNotice />

  return <>{children}</>
}
