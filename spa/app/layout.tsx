import type { Metadata } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import { AuthGate } from '@/components/auth-gate'
import { ActionFeedbackProvider } from '@/components/action-feedback'
import { NewEventDrawerProvider } from '@/components/new-event-drawer-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthenticatedAppShell } from '@/components/authenticated-app-shell'

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-sans',
  fallback: ['sans-serif'],
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
  // `icon.svg` / `icon-light-32x32.png` / `icon-dark-32x32.png` were referenced
  // here but never existed in `public/`, so every page load 404'd on them (#106).
  // `app/favicon.ico` already covers the browser tab icon via Next's file
  // convention, so it's left out of this object. `apple-icon.png` is the one
  // asset we do have (reused from the Capacitor iOS app icon).
  icons: {
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={bricolageGrotesque.variable} suppressHydrationWarning>
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
