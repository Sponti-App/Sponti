"use client"

import Link from "next/link"
import { QrCodeIcon, ShareNetworkIcon } from "@/components/icons"
import { AccountAvatar } from "@/components/account-avatar"
import type { ShareTab } from "@/components/qr-share-sheet"
import { Button } from "@/components/ui/button"
import type { AuthUser } from "@/lib/auth-store"

// #369: your @handle at the top of the friends screen (circles), with share
// (the invite link) and qr code. It replaces the lone QR icon that used to
// sit in the circles header, and gives the empty state something to point at.
export function HandleCard({
  user,
  onShare,
}: {
  user: AuthUser | null
  /** Opens the share sheet on that tab. */
  onShare: (tab: ShareTab) => void
}) {
  return (
    <section aria-label="your handle" data-handle-card className="pt-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <AccountAvatar
            user={user}
            className="size-11"
            fallbackClassName="bg-accent/10 text-sm font-medium text-accent-ink"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              @{user?.username ?? "you"}
            </p>
            {user?.displayName && (
              <p className="truncate text-xs text-muted-foreground">
                {user.displayName}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onShare("link")}
            className="h-10 flex-1 rounded-full"
          >
            <ShareNetworkIcon className="h-4 w-4" />
            share
          </Button>
          <Button
            variant="outline"
            onClick={() => onShare("qr")}
            className="h-10 flex-1 rounded-full"
          >
            <QrCodeIcon className="h-4 w-4" />
            qr code
          </Button>
        </div>
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        anyone with your @handle can find you and send a request. who can find
        you is in{" "}
        <Link
          href="/settings"
          className="font-medium text-foreground underline underline-offset-2"
        >
          settings
        </Link>
        .
      </p>
    </section>
  )
}
