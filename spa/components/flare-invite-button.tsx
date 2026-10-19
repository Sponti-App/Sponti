"use client"

// The host's "invite" button on a flare (#616): opens the phone's share sheet
// with "patrick invited you to drinks at klunkerkranich, sat 7:00 pm" and the
// flare's own link, or copies the link and says "link copied" where there is
// no share sheet. The link works for open-to-all and invite-only flares alike.
//
// The link is fetched as soon as the button is on screen, not on tap: Safari
// only opens a share sheet inside the gesture that asked for it, and an await
// on the network in between drops that.

import { useEffect, useState } from "react"
import { ShareNetworkIcon } from "@/components/icons"
import { useActionFeedback } from "@/components/action-feedback"
import { Button } from "@/components/ui/button"
import { fetchEventInviteLink } from "@/lib/api/flare-invites"
import type { HostedEvent } from "@/lib/api/events"
import {
  buildFlareInviteUrl,
  flareInviteMessage,
} from "@/lib/flare-invite-links"
import { shareLink } from "@/lib/share-link"

export function FlareInviteButton({
  event,
  hostName,
}: {
  event: Pick<HostedEvent, "id" | "title" | "type" | "startAt" | "endAt">
  /** The host's own name, for "patrick invited you to ...". */
  hostName?: string | null
}) {
  const { showActionFeedback } = useActionFeedback()
  const [link, setLink] = useState<{ eventId: string; token: string } | null>(
    null
  )
  const [failed, setFailed] = useState(false)
  const token = link?.eventId === event.id ? link.token : null

  useEffect(() => {
    const controller = new AbortController()
    fetchEventInviteLink(event.id, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setLink({ eventId: event.id, token: next })
        setFailed(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [event.id])

  const retry = () => {
    setFailed(false)
    fetchEventInviteLink(event.id)
      .then((next) => setLink({ eventId: event.id, token: next }))
      .catch(() => {
        setFailed(true)
        showActionFeedback("couldn't get the link", { tone: "error" })
      })
  }

  const invite = async () => {
    if (!token) {
      if (failed) retry()
      return
    }
    const url = buildFlareInviteUrl(token)
    if (!url) {
      showActionFeedback("couldn't make the link", { tone: "error" })
      return
    }
    const result = await shareLink({
      text: flareInviteMessage({ ...event, hostName }),
      url,
    })
    if (result === "copied") showActionFeedback("link copied")
    else if (result === "failed")
      showActionFeedback("couldn't share the link", { tone: "error" })
  }

  return (
    <Button
      variant="outline"
      data-flare-invite-button
      onClick={() => void invite()}
      disabled={!token && !failed}
      className="h-10 gap-1.5 rounded-full bg-background/90 px-3.5 text-sm"
    >
      <ShareNetworkIcon className="h-4 w-4" />
      invite
    </Button>
  )
}
