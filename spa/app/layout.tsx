import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import { AuthGate } from '@/components/auth-gate'
import { ActionFeedbackProvider } from '@/components/action-feedback'
import { NewEventDrawerProvider } from '@/components/new-event-drawer-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthenticatedAppShell } from '@/components/authenticated-app-shell'
import { resolveSiteUrl } from '@/lib/site-url'

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-sans',
  fallback: ['sans-serif'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Browser / standalone chrome colour (#131), matching `--background` in each
  // scheme (BRAND.md; hex via oklch -> sRGB, same as `app/manifest.ts`). These
  // follow the OS scheme, like ThemeProvider's `defaultTheme="system"`.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdf1f7' },
    { media: '(prefers-color-scheme: dark)', color: '#171a21' },
  ],
}

// Shared link-preview copy (#127). This is intentionally the same for every
// route, including `/event/[id]` — event links must stay generic (no title,
// location, or host) so private event details never leak into a chat preview.
// The image comes from `app/opengraph-image.tsx` / `app/twitter-image.tsx`
// (Next's file-convention route), which every page inherits unless it defines
// its own — no page does, so the same branded image is used everywhere.
const title = 'sponti'
const description = 'light a flare and get your friends there.'

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title,
  description,
  // `icon.svg` / `icon-light-32x32.png` / `icon-dark-32x32.png` were referenced
  // here but never existed in `public/`, so every page load 404'd on them (#106).
  // `app/favicon.ico` already covers the browser tab icon via Next's file
  // convention, so it's left out of this object. `apple-icon.png` is the one
  // asset we do have (reused from the Capacitor iOS app icon).
  icons: {
    apple: '/apple-icon.png',
  },
  // iOS home-screen launch (#131). `default` keeps the status bar opaque and
  // the webview below it, so it never overlaps content and doesn't stack with
  // the `env(safe-area-inset-top)` padding on `body` (`black-translucent` would
  // draw under the bar and double up those insets).
  appleWebApp: {
    capable: true,
    title,
    statusBarStyle: 'default',
  },
  // Next only emits the standard `mobile-web-app-capable` for `capable: true`;
  // iOS before 16.4 only honours the Apple-prefixed tag (no manifest `display`
  // support), so testers on older iPhones would otherwise get a Safari tab.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title,
    description,
    siteName: title,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={bricolageGrotesque.variable}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate>
              <ActionFeedbackProvider>
                <NewEventDrawerProvider>
                  <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
                </NewEventDrawerProvider>
              </ActionFeedbackProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
