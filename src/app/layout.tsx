import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Source_Sans_3, Turret_Road } from 'next/font/google'
import './globals.css'
import { serviceWorkerRegistrationScript } from './serviceWorkerRegistration'

// Self-hosted at build time: the game's own faces, no runtime request to Google.
const sans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const display = Turret_Road({
  subsets: ['latin'],
  weight: '800',
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Infinite Conflict Simulator',
  description: 'Deterministic turn-based simulator and build planner for Infinite Conflict.',
  manifest: './manifest.json',
  applicationName: 'IC Sim',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IC Sim',
  },
  icons: {
    icon: [
      { url: './icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: './icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: './icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: './icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0E0A14',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="min-h-screen relative">{children}</div>

        {/* Register the PWA service worker outside local dev hosts only — dev rebuilds
            invalidate the worker on every reload, which is noisy and stale-cache prone. */}
        <Script id="sw-register" strategy="afterInteractive">
          {serviceWorkerRegistrationScript}
        </Script>
      </body>
    </html>
  )
}
