import React from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Florent Simulator - Infinite Conflict Build Planner',
  description: 'Interactive build order simulator for Infinite Conflict game strategy planning',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="no-js">
      <head>
        {/* Intentionally empty head: fonts handled via next/font */}
      </head>

      <body className={inter.className}>
        {/* Star background layers from template */}
        <div id="stars1" />
        <div id="stars2" />
        <div id="stars3" />

        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </body>
    </html>
  )
}
