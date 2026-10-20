import type { Metadata } from "next"
import { headers } from "next/headers"
import {
  fetchFlareInvitePreviewOnServer,
  flareInviteCard,
} from "@/lib/server/flare-invite-preview"

// #616: what a chat app shows when a flare's invite link is pasted into it.
// A live link gets its own card (who invited them, the title, the time and the
// place name, never the address or guests) and its own image (./og). Any other
// link (unknown, reset, ended, cancelled, or the api not answering) gets
// nothing of its own: the site's generic preview from the root layout stays.
// Either way the page is kept out of search results, and nothing is cached, so
// a reset or ended link stops previewing at once.

const ROBOTS = { index: false, follow: false } as const

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const token = decode((await params).token)
  const preview = await fetchFlareInvitePreviewOnServer(token)
  if (!preview) return { robots: ROBOTS }

  const card = flareInviteCard(preview)
  // On the site the link was opened on: the root layout's metadataBase is the
  // production domain, which a preview deploy's link may not exist on.
  const image = `${await requestOrigin()}/f/${encodeURIComponent(token)}/og`
  return {
    title: card.title,
    description: card.description,
    robots: ROBOTS,
    openGraph: {
      type: "website",
      siteName: "sponti",
      title: card.title,
      description: card.description,
      images: [{ url: image, width: 1200, height: 630, alt: card.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: card.title,
      description: card.description,
      images: [image],
    },
  }
}

/** "https://<host>" of this request, or "" to fall back on metadataBase. */
async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (!host) return ""
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https"
  return `${proto}://${host}`
}

export default function FlareInviteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
