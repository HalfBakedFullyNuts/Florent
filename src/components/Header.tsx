import React from 'react'

export default function Header() {
  return (
    <header className="bg-pink-nebula-panel px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-2">
          <button className="px-3 py-1 rounded bg-pink-nebula-accent-primary text-pink-nebula-text">HW</button>
          <button className="px-3 py-1 rounded text-pink-nebula-muted">Mars</button>
          <button className="px-3 py-1 rounded text-pink-nebula-muted border border-pink-nebula-border">+</button>
        </nav>
      </div>
    </header>
  )
}
