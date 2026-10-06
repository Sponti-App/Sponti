"use client"

// PROTOTYPE (#369) — what the share shortcut opens: one sheet with the QR
// code and the invite link as two tabs. `open=qr|link` is the tab it opens
// on. Same two ways to add you as QrShareSheet (#124): the QR is the
// 15-minute in-person code, the link the 7-day one for group chats. The QR
// is drawn the way QrShareSheet draws it (qrcode, same options), from a mock
// url; nothing is fetched.

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  ShareNetworkIcon,
  XIcon,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { INVITE_URL, ME, QR_URL } from "./_mock"
import { MockHome, type ScreenProps } from "./_shared"
import { FriendsScreen } from "./_friends"

export function ShareScreen(props: ScreenProps) {
  const { state, go } = props
  const back = state.base
  return (
    <>
      {back === "friends" ? (
        <FriendsScreen {...props} />
      ) : (
        <MockHome {...props} />
      )}
      <ShareSheet
        key={state.open}
        initialTab={state.open}
        onClose={() =>
          go({ screen: back === "friends" ? "friends" : "home", base: "home" })
        }
        stub={props.stub}
      />
    </>
  )
}

function useQrDataUrl(url: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: "#171717", light: "#ffffff" },
    }).then((next) => {
      if (live) setDataUrl(next)
    })
    return () => {
      live = false
    }
  }, [url])
  return dataUrl
}

function ShareSheet({
  initialTab,
  onClose,
  stub,
}: {
  initialTab: "qr" | "link"
  onClose: () => void
  stub: (what: string) => void
}) {
  const [tab, setTab] = useState(initialTab)
  const [copied, setCopied] = useState(false)
  const qr = useQrDataUrl(QR_URL)

  const copy = () => {
    setCopied(true)
    stub("link copied")
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="proto-fade absolute inset-0 bg-foreground/30"
      />
      <div className="proto-up relative mt-auto flex flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-base font-semibold">invite a friend</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "qr" | "link")}>
            <TabsList className="h-9 w-full">
              <TabsTrigger value="link">invite link</TabsTrigger>
              <TabsTrigger value="qr">qr code</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Both tabs hold the same height, so switching doesn't jump. */}
        <div className="flex min-h-[25.5rem] flex-col px-6 pt-5 pb-8">
          {tab === "qr" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="text-base font-semibold">{ME.displayName}</p>
                <p className="text-sm text-muted-foreground">@{ME.username}</p>
              </div>
              <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-border bg-background p-4">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt={`qr code for @${ME.username}`}
                    className="h-full w-full"
                  />
                ) : (
                  <CircleNotchIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="max-w-[260px] text-center text-xs text-muted-foreground">
                for when you&apos;re together. they scan it and you&apos;re
                friends right away. the code refreshes every 15 min.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <p className="text-sm">
                send this to a friend or a group chat. whoever opens it can send
                you a friend request.
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background py-1 pr-1 pl-3">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {INVITE_URL.replace(/^https:\/\//, "")}
                </span>
                <Button
                  variant="ghost"
                  onClick={copy}
                  className="h-9 rounded-lg px-3"
                >
                  {copied ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                  {copied ? "copied" : "copy"}
                </Button>
              </div>

              <Button
                onClick={() => stub("native share sheet")}
                className="mt-4 h-12 w-full rounded-full bg-accent text-base text-accent-foreground hover:bg-accent/90"
              >
                <ShareNetworkIcon className="mr-1 h-4 w-4" />
                share link
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                works for 7 days. you&apos;ll see each request before
                you&apos;re friends.
              </p>

              <button
                type="button"
                onClick={() => stub("reset link")}
                className="mx-auto mt-2 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" />
                reset link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
