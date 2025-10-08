'use client'

import { useMemo, useState, type FormEvent } from 'react'

type Planet = {
  id: string
  name: string
  metalAbund: number
  mineralAbund: number
  foodAbund: number
}

type QueueItem = {
  id: string
  planetId: string
  itemName: string
  count: number
}

type Cost = {
  type: 'B' | 'S' | 'O'
  name: string
  metCost: number
  minCost: number
  foodCost: number
  energyCost: number
  metOut?: number
  minOut?: number
  foodOut?: number
  energyOut?: number
}

const COSTS: Cost[] = [
  { type: 'B', name: 'Metal Mine', metCost: 100, minCost: 0, foodCost: 0, energyCost: 0, metOut: 10 },
  { type: 'B', name: 'Mineral Extractor', metCost: 0, minCost: 100, foodCost: 0, energyCost: 0, minOut: 10 },
  { type: 'B', name: 'Farm', metCost: 0, minCost: 0, foodCost: 100, energyCost: 0, foodOut: 10 },
  { type: 'B', name: 'Solar Generator', metCost: 0, minCost: 0, foodCost: 0, energyCost: 100, energyOut: 10 },
  { type: 'S', name: 'Scout', metCost: 50, minCost: 50, foodCost: 0, energyCost: 0 },
  { type: 'O', name: 'Infantry', metCost: 10, minCost: 10, foodCost: 0, energyCost: 0 },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export default function Home() {
  const [planets, setPlanets] = useState<Planet[]>([])
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [turn, setTurn] = useState<number>(1)

  const selectedPlanet = useMemo(
    () => planets.find(p => p.id === selectedPlanetId) || null,
    [planets, selectedPlanetId]
  )

  const planetQueue = useMemo(
    () => queue.filter(q => q.planetId === selectedPlanetId),
    [queue, selectedPlanetId]
  )

  function addPlanet(name: string, metalAbund: number, mineralAbund: number, foodAbund: number) {
    const id = uid()
    const p: Planet = { id, name, metalAbund, mineralAbund, foodAbund }
    setPlanets(prev => [...prev, p])
    setSelectedPlanetId(id)
  }

  function addQueueItem(itemName: string, count: number) {
    if (!selectedPlanet) return
    setQueue(prev => [...prev, { id: uid(), planetId: selectedPlanet.id, itemName, count }])
  }

  function removeQueueItem(id: string) {
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  function getCost(name: string): Cost | undefined {
    return COSTS.find(c => c.name === name)
  }

  const totalQueuedCosts = useMemo(() => {
    return planetQueue.reduce(
      (acc, it) => {
        const c = getCost(it.itemName)
        if (!c) return acc
        acc.met += c.metCost * it.count
        acc.min += c.minCost * it.count
        acc.food += c.foodCost * it.count
        acc.energy += c.energyCost * it.count
        return acc
      },
      { met: 0, min: 0, food: 0, energy: 0 }
    )
  }, [planetQueue])

  const estimatedOutputs = useMemo(() => {
    if (!selectedPlanet) return { met: 0, min: 0, food: 0, energy: 0 }
    const out = { met: 0, min: 0, food: 0, energy: 0 }
    for (const it of planetQueue) {
      const c = getCost(it.itemName)
      if (!c) continue
      out.met += (c.metOut || 0) * it.count * selectedPlanet.metalAbund
      out.min += (c.minOut || 0) * it.count * selectedPlanet.mineralAbund
      out.food += (c.foodOut || 0) * it.count * selectedPlanet.foodAbund
      out.energy += (c.energyOut || 0) * it.count
    }
    return out
  }, [planetQueue, selectedPlanet])

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Infinite Conflict - Build Planner</h1>
        <p className="text-sm text-gray-600">Planets, build queue, costs, and current turn stats</p>
      </header>

      <section className="card">
        <div className="card-header">
          <h2 className="font-semibold">Planets</h2>
        </div>
        <div className="card-body space-y-4">
          <div className="flex flex-wrap gap-2">
            {planets.length === 0 && (
              <div className="text-sm text-gray-600">No planets yet. Add one below.</div>
            )}
            {planets.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlanetId(p.id)}
                className={`px-3 py-1 rounded border ${selectedPlanetId === p.id ? 'bg-gray-100' : ''}`}
                title={`${Math.round(p.metalAbund * 100)}% Metal | ${Math.round(p.mineralAbund * 100)}% Mineral | ${Math.round(p.foodAbund * 100)}% Food`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <AddPlanetForm onAdd={addPlanet} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">
              Build Queue {selectedPlanet ? `for ${selectedPlanet.name}` : ''}
            </h2>
          </div>
          <div className="card-body space-y-4">
            {!selectedPlanet && (
              <div className="text-sm text-gray-600">Select or add a planet to manage its queue.</div>
            )}
            {selectedPlanet && (
              <>
                <AddQueueItemForm onAdd={addQueueItem} />
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Count</th>
                        <th>Cost (M/Mi/F/E)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {planetQueue.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-gray-600">
                            No items queued
                          </td>
                        </tr>
                      ) : (
                        planetQueue.map(it => {
                          const c = getCost(it.itemName)
                          const costText = c
                            ? `${c.metCost * it.count}/${c.minCost * it.count}/${c.foodCost * it.count}/${c.energyCost * it.count}`
                            : '-'
                          return (
                            <tr key={it.id}>
                              <td className="font-medium">{it.itemName}</td>
                              <td>{it.count}</td>
                              <td>{costText}</td>
                              <td>
                                <button className="text-red-600" onClick={() => removeQueueItem(it.id)}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="card-footer">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Queued Costs</div>
                <div className="text-lg font-semibold">
                  M: {totalQueuedCosts.met} • Mi: {totalQueuedCosts.min} • F: {totalQueuedCosts.food} • E: {totalQueuedCosts.energy}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-600">Estimated Outputs / turn</div>
                <div className="text-lg font-semibold">
                  M: {Math.round(estimatedOutputs.met)} • Mi: {Math.round(estimatedOutputs.min)} • F: {Math.round(estimatedOutputs.food)} • E: {Math.round(estimatedOutputs.energy)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Turn & Resources</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Current Turn</div>
                <div className="text-xl font-semibold">{turn}</div>
              </div>
              <div className="space-x-2">
                <button
                  className="px-3 py-1 rounded border"
                  onClick={() => setTurn(t => t - 1)}
                  disabled={turn <= 1}
                >
                  Prev
                </button>
                <button
                  className="px-3 py-1 rounded border"
                  onClick={() => setTurn(t => t + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function AddPlanetForm({ onAdd }: { onAdd: (name: string, metalAbund: number, mineralAbund: number, foodAbund: number) => void }) {
  const [name, setName] = useState('')
  const [metal, setMetal] = useState(1)
  const [mineral, setMineral] = useState(1)
  const [food, setFood] = useState(1)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim(), Number(metal), Number(mineral), Number(food))
    setName('')
  }

  return (
    <form className="space-y-2" onSubmit={submit}>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Planet name" className="flex-1 px-3 py-1 border rounded" />
        <input type="number" value={metal} onChange={e => setMetal(Number(e.target.value))} className="w-20 px-2 py-1 border rounded" />
        <input type="number" value={mineral} onChange={e => setMineral(Number(e.target.value))} className="w-20 px-2 py-1 border rounded" />
        <input type="number" value={food} onChange={e => setFood(Number(e.target.value))} className="w-20 px-2 py-1 border rounded" />
        <button className="px-3 py-1 rounded border" type="submit">Add</button>
      </div>
      <div className="text-xs text-gray-500">Abundances are multipliers (e.g. 1 = 100%)</div>
    </form>
  )
}

function AddQueueItemForm({ onAdd }: { onAdd: (itemName: string, count: number) => void }) {
  const [item, setItem] = useState(COSTS[0].name)
  const [count, setCount] = useState(1)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!item) return
    onAdd(item, Number(count))
    setCount(1)
  }

  return (
    <form className="flex gap-2 items-center" onSubmit={submit}>
      <select value={item} onChange={e => setItem(e.target.value)} className="px-2 py-1 border rounded">
        {COSTS.map(c => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
      </select>
      <input type="number" value={count} min={1} onChange={e => setCount(Number(e.target.value))} className="w-24 px-2 py-1 border rounded" />
      <button className="px-3 py-1 rounded border" type="submit">Queue</button>
    </form>
  )
}
