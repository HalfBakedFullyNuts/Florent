import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

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
  themeColor: '#21182c',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* External fonts and icons */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,700|Turret+Road:200,400,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />

        {/* External game stylesheet removed — it caused hydration mismatches
             because it was unavailable during SSR. Vendor locally if needed. */}

        {/* Provide a small inline script to set baseUrl as in the original template */}
        <script dangerouslySetInnerHTML={{ __html: "window.baseUrl = 'https://beta.infiniteconflict.com';" }} />
      </head>

      <body suppressHydrationWarning>
        {/* Star background layers from template */}
        <div id="stars1" />
        <div id="stars2" />
        <div id="stars3" />

        {/* Vibrant gradient background to show blur effect */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-purple-900 via-pink-900 to-blue-900" />

        <div className="min-h-screen text-pink-nebula-text relative">{children}</div>

        {/* Register the PWA service worker (production builds only — dev rebuilds
            invalidate the worker on every reload, which is noisy). */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch((err) => {
                  console.warn('[SW] registration failed:', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
