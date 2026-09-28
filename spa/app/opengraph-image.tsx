import { ImageResponse } from 'next/og'

// Branded link-preview image (#127), generated at request time via Next's
// file-convention route so it needs no build step or binary asset pipeline.
// This is deliberately generic — no event title, location, or host — because
// every route inherits it (nothing under app/ defines its own opengraph-image
// or twitter-image), including `/event/[id]`, and event links must stay
// generic so private event details never leak into a chat preview.
//
// Colours are the hex approximations of the oklch tokens in BRAND.md
// (light-mode background/foreground/muted-foreground, and the brand peach
// accent) — `next/og` renders via Satori, which doesn't reliably support the
// `oklch()` CSS function, so the hex values are used directly here instead.
export const alt = 'Sponti'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BACKGROUND = '#fdf1f7' // --background (light)
const FOREGROUND = '#351428' // --foreground (light)
const MUTED_FOREGROUND = '#755a68' // --muted-foreground (light)
const ACCENT = '#f8b187' // --primary / --accent
const ACCENT_FOREGROUND = '#3a2418' // --primary-foreground / --accent-foreground

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: BACKGROUND,
          position: 'relative',
        }}
      >
        {/* Soft decorative flare glows, kept behind the content. */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: 999,
            background: ACCENT,
            opacity: 0.35,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -140,
            width: 420,
            height: 420,
            borderRadius: 999,
            background: ACCENT,
            opacity: 0.22,
            display: 'flex',
          }}
        />

        {/* Flare mark: a solid peach dot, echoing the map-pin / live-flare motif. */}
        <div
          style={{
            display: 'flex',
            width: 96,
            height: 96,
            borderRadius: 999,
            background: ACCENT,
            marginBottom: 36,
          }}
        />

        <div
          style={{
            display: 'flex',
            fontSize: 128,
            fontWeight: 700,
            color: FOREGROUND,
            letterSpacing: -2,
          }}
        >
          Sponti
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 20,
            fontSize: 38,
            fontWeight: 500,
            color: MUTED_FOREGROUND,
          }}
        >
          light a flare and get your friends there.
        </div>

        {/* A CTA-style pill, matching the app's primary button treatment. */}
        <div
          style={{
            display: 'flex',
            marginTop: 48,
            padding: '16px 40px',
            borderRadius: 999,
            background: ACCENT,
            color: ACCENT_FOREGROUND,
            fontSize: 30,
            fontWeight: 600,
          }}
        >
          light a flare
        </div>
      </div>
    ),
    { ...size },
  )
}
