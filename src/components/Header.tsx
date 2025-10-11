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

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-pink-nebula-panel rounded-full" />
          <div className="text-sm text-pink-nebula-text">30,000</div>
          <div className="text-sm text-pink-nebula-muted">+1,200/t</div>
        </div>
      </div>
    </header>
  )
}
