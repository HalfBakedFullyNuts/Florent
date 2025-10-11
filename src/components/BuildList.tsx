import React from 'react'

type Item = { id: string; name: string; tier?: string }

export default function BuildList({ items = [] as Item[] }: { items?: Item[] }) {
  return (
    <aside className="bg-pink-nebula-bg p-4">
      <div className="bg-pink-nebula-panel p-3 rounded border border-pink-nebula-border">
        <h2 className="text-lg font-semibold text-pink-nebula-text">Build List</h2>
        <div className="mt-3">
          <div className="text-sm text-pink-nebula-muted mb-2">Tier 1</div>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between p-2 rounded hover:bg-opacity-5 hover:bg-pink-nebula-panel">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-pink-nebula-panel rounded" />
                  <div>
                    <div className="text-pink-nebula-text">{it.name}</div>
                    <div className="text-pink-nebula-muted text-xs">{it.tier || 'Tier 1'}</div>
                  </div>
                </div>
                <button className="px-3 py-1 rounded bg-pink-nebula-accent-primary text-pink-nebula-text hover:bg-pink-nebula-accent-secondary">Queue</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
