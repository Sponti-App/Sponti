import { ImageResponse } from "next/og"
import {
  fetchFlareInvitePreviewOnServer,
  flareInviteCard,
  isFlareInviteToken,
} from "@/lib/server/flare-invite-preview"

// #616: the image in a flare invite link's preview card (1200x630). Same
// words as the metadata in ../layout.tsx: who invited them, the title, the
// time and the place name. Only someone holding the link can fetch it, and only
// a live link gets one: any other token is sent to the site's generic preview
// image. Brand tokens (BRAND.md) as hex, since the image renderer has no oklch:
// the dark ink background, warm cream text, and the one peach.
//
// The renderer's built-in sans stands in for Bricolage Grotesque, which would
// have to be fetched on every image.

const INK = "#171a21"
const CARD = "#2a2f3a"
const CREAM = "#fbf1e8"
const MUTED = "#c9bdb2"
const PEACH = "#ffa770"
const PEACH_INK = "#3a2418"
const GENERIC_IMAGE = "/opengraph-image.png"

// A minute at most on our side, so a reset or ended link stops previewing
// soon. Chat apps keep what they fetched for as long as they like; the old
// link is a different URL from a reset one, so a new link never shows the old
// card.
const CACHE = "public, max-age=60, s-maxage=60"

export const dynamic = "force-dynamic"

function generic(request: Request): Response {
  return Response.redirect(new URL(GENERIC_IMAGE, request.url), 307)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  let token = (await params).token
  try {
    token = decodeURIComponent(token)
  } catch {
    return generic(request)
  }
  if (!isFlareInviteToken(token)) return generic(request)

  const preview = await fetchFlareInvitePreviewOnServer(token)
  if (!preview) return generic(request)

  const card = flareInviteCard(preview)

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: INK,
        color: CREAM,
        padding: 72,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 56,
            background: PEACH,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 256 256" fill={PEACH_INK}>
            <path d="M208,144A80,80,0,0,1,130.06,224,40,40,0,0,0,168,184c0-40-40-64-40-64s-40,24-40,64A40,40,0,0,0,125.94,224,80,80,0,0,1,48,144c0-72,80-120,80-120S208,72,208,144Z" />
          </svg>
        </div>
        <div style={{ marginLeft: 18, fontSize: 36, fontWeight: 700 }}>
          sponti
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 168,
            height: 168,
            borderRadius: 168,
            background: CARD,
            fontSize: 76,
            fontWeight: 700,
          }}
        >
          {card.hostName.slice(0, 1).toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 48,
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 40, color: MUTED }}>{card.invitedLine}</div>
          <div
            style={{
              marginTop: 12,
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.1,
              lineClamp: 2,
            }}
          >
            {card.flareTitle}
          </div>
          <div style={{ marginTop: 20, fontSize: 36, color: MUTED }}>
            {card.meta}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 30, color: MUTED }}>
        light a flare and get your friends there.
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": CACHE } }
  )
}
