import React from 'react'

export default function QueueCard({ name = 'Metal Mine', turns = 4, progress = 0.4, onDelete }: { name?: string; turns?: number; progress?: number; onDelete?: () => void }) {
  return (
    <div className="bg-pink-nebula-bg border border-pink-nebula-border rounded p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-pink-nebula-panel rounded" />
        <div>
          <div className="text-pink-nebula-text">{name}</div>
          <div className="text-pink-nebula-muted text-xs">{turns} turns</div>
          <div className="w-40 h-2 bg-pink-nebula-bg rounded mt-2 overflow-hidden">
            <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, background: 'var(--accent-primary)' }} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-pink-nebula-muted">{turns}</div>
        <button aria-label="delete" onClick={onDelete} className="text-pink-nebula-muted hover:text-pink-nebula-accent-secondary">✕</button>
      </div>
    </div>
  )
}
