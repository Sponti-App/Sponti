import {
  CameraIcon,
  ArrowSquareOutIcon,
  PaperPlaneRightIcon,
} from "@/components/icons"
import type { ProfileSocials } from "@/lib/api/users"

// Socials as pill buttons that open the app or site in a new tab (#289).
// The api sends a bare handle, already validated by auth-server; it is
// encoded anyway, so a value can never change the link's path.

const NETWORKS = [
  {
    key: "instagram",
    label: "instagram",
    Icon: CameraIcon,
    url: (handle: string) =>
      `https://instagram.com/${encodeURIComponent(handle)}`,
  },
  {
    key: "telegram",
    label: "telegram",
    Icon: PaperPlaneRightIcon,
    url: (handle: string) => `https://t.me/${encodeURIComponent(handle)}`,
  },
] as const

export function ProfileSocialPills({ socials }: { socials: ProfileSocials }) {
  const shown = NETWORKS.flatMap((network) => {
    const handle = socials[network.key]
    return handle ? [{ ...network, handle }] : []
  })

  // Nothing to show renders nothing: no heading, no empty row.
  if (shown.length === 0) return null

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {shown.map(({ key, label, Icon, url, handle }) => (
        <a
          key={key}
          href={url(handle)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label} @${handle}, opens ${label}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />@
          {handle}
          <ArrowSquareOutIcon
            className="h-3 w-3 text-muted-foreground"
            aria-hidden
          />
        </a>
      ))}
    </div>
  )
}
