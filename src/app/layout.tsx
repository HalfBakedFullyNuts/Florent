import type { Metadata } from 'next'
import './globals.css'
import Header from '../components/Header'

export const metadata: Metadata = {
  title: 'Infinite Conflict - Build Planner',
  description: 'Early-game build planner for Infinite Conflict',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="no-js">
      <head>
        {/* External fonts and icons */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,700|Turret+Road:200,400,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />

        {/* External game stylesheet (preload + stylesheet) */}
        <link rel="preload" as="style" href="https://beta.infiniteconflict.com/build/assets/app-uhxyo077.css" />
        <link rel="stylesheet" href="https://beta.infiniteconflict.com/build/assets/app-uhxyo077.css" />

        {/* Provide a small inline script to set baseUrl as in the original template */}
        <script dangerouslySetInnerHTML={{ __html: "window.baseUrl = 'https://beta.infiniteconflict.com';" }} />
      </head>

      <body>
        {/* Star background layers from template */}
        <div id="stars1" />
        <div id="stars2" />
        <div id="stars3" />

        <Header />

        <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text">{children}</div>
      </body>
    </html>
  )
}
