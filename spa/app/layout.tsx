import type { Metadata } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import { AuthGate } from '@/components/auth-gate'
import { NewEventDrawerProvider } from '@/components/new-event-drawer-provider'
import { ThemeProvider } from '@/components/theme-provider'

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
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
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
              <NewEventDrawerProvider>{children}</NewEventDrawerProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

