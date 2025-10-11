"use client";
import React, { useMemo, useState, type FormEvent } from 'react';
import colonistData from '../data/colonistTypes.json';
import GameData from '../lib/game/dataManager';
import type { Unit as GUnit, Structure as GStructure } from '../lib/game/dataManager';
import { enqueueItem, cancelQueueItemImpl, processTick } from '../lib/game/agent';
import type { PlayerState } from '../lib/game/types';

type Planet = {
  id: string;
  name: string;
  metalAbund: number;
  mineralAbund: number;
  foodAbund: number;
}
type QueueItem = {
  id: string;
  planetId: string;
  itemName: string;
  count: number;
}
type ColonistCost = {
  metal: number;
  mineral: number;
  worker_input: number;
  food_upkeep_per_100: number;
  turns_to_produce: number;
}
type ColonistType = {
  name: string;
  type: string;
  cost: ColonistCost;
  prerequisites: Array<{ type: string; name: string }>;
  additional_cost?: string;
  storage_required?: string;
  score_value?: number;
}
const COLONISTS: ColonistType[] = (colonistData as unknown as { colonist_types: ColonistType[] }).colonist_types;

// Lightweight runtime logger to help debug component state
function debugLog(label: string, data?: unknown) {
  try {
    // Use console.debug so it can be filtered; stringify where appropriate
    const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    // eslint-disable-next-line no-console
    console.debug(`[page.tsx] ${new Date().toISOString()} - ${label}:`, payload)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug(`[page.tsx] ${label}: (unserializable)`, data)
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export default function Home() {
  // Only one set of hooks and variables
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [turn, setTurn] = useState<number>(1);
  const [lastError, setLastError] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerState>(() => ({
    resources: { mass: 100000, mineral: 100000, food: 100000, energy: 100000 },
    income: { mass: 0, mineral: 0, food: 0, energy: 0 },
    ownedBuildings: [],
    completedResearch: [],
    buildQueue: [],
    unitQueueByFactory: {},
    unitCounts: {},
    tick: 0,
    meta: {},
  }));
  const planetSummaryRows = [
    { id: 'metal', label: 'Metal', color: 'text-pink-nebula-text', stored: player.resources.mass, output: '+1200', abundance: '100%' },
    { id: 'mineral', label: 'Mineral', color: 'text-pink-nebula-text', stored: player.resources.mineral, output: '+800', abundance: '100%' },
    { id: 'food', label: 'Food', color: 'text-pink-nebula-text', stored: player.resources.food, output: '+200', abundance: '100%' },
    { id: 'energy', label: 'Energy', color: 'text-pink-nebula-text', stored: player.resources.energy, output: '+130', abundance: '100%' },
  ];

  const selectedPlanet = useMemo(
    () => planets.find(p => p.id === selectedPlanetId) || null,
    [planets, selectedPlanetId]
  )

  const planetQueue = useMemo(() => {
    // For now buildQueue items are global and not assigned to planets. Show all items.
    return player.buildQueue
  }, [player.buildQueue])

  function addPlanet(name: string, metalAbund: number, mineralAbund: number, foodAbund: number) {
    const id = uid()
    const p: Planet = { id, name, metalAbund, mineralAbund, foodAbund }
    setPlanets(prev => [...prev, p])
    setSelectedPlanetId(id)
    debugLog('addPlanet', { id, name, metalAbund, mineralAbund, foodAbund, planetsCount: planets.length + 1 })
  }

  function addQueueItem(itemId: string, itemType: 'structure' | 'unit', count: number) {
    if (!selectedPlanet) return
    setLastError(null)
    // Attempt to enqueue via agent to validate costs/prereqs and update player state
    try {
      const res = enqueueItem(player, itemId, itemType, count)
      if (!res.ok) {
        setLastError(res.reason || 'Unable to queue item')
        return
      }
      // agent mutates player in-place; trigger React update
      setPlayer({ ...player })
      debugLog('addQueueItem - enqueued', { itemId, itemType, count, playerSnapshot: player })
    } catch (e) {
      // coerce message if present
      const msg = (e as any)?.message || String(e)
      setLastError(msg)
    }
    // end addQueueItem

    debugLog('addQueueItem - exit', { selectedPlanetId, lastError })
  }

  // Move these functions outside of the return statement
  const removeQueueItem = (id: string) => {
    const res = cancelQueueItemImpl(player, id)
    if (!res.ok) setLastError(res.reason || 'Unable to cancel')
    setPlayer({ ...player })
    debugLog('removeQueueItem', { id, ok: res.ok, playerSnapshot: player })
  }

  const getColonist = (name: string): ColonistType | undefined => {
    return COLONISTS.find(c => c.name === name)
  }

  const totalQueuedCosts = useMemo(() => {
    const totals = { met: 0, min: 0, food: 0, energy: 0 }
    for (const qi of planetQueue) {
      const defUnit = GameData.getUnitById(qi.name)
      const defStruct = GameData.getStructureById(qi.name)
      const def = defUnit || defStruct
      if (!def || !def.cost) continue
      for (const c of def.cost) {
        if ((c as any).type === 'resource') {
          const id = (c as any).id as string
          const amt = Math.round((c as any).amount || 0)
          if (id === 'metal') totals.met += amt
          else if (id === 'mineral') totals.min += amt
          else if (id === 'food') totals.food += amt
          else if (id === 'energy') totals.energy += amt
        }
      }
    }
    return totals
  }, [planetQueue])

  const estimatedOutputs = useMemo(() => {
    if (!selectedPlanet) return { met: 0, min: 0, food: 0, energy: 0 }
    const out = { met: 0, min: 0, food: 0, energy: 0 }
    for (const b of player.ownedBuildings) {
      const def = GameData.getStructureById(b.name)
      if (!def || !def.operations || !def.operations.production) continue
      for (const p of def.operations.production) {
        let amt = p.base_amount || 0
        if (p.is_abundance_scaled) {
          if (p.type === 'metal') amt *= selectedPlanet.metalAbund
          if (p.type === 'mineral') amt *= selectedPlanet.mineralAbund
          if (p.type === 'food') amt *= selectedPlanet.foodAbund
        }
        if (p.type === 'metal') out.met += Math.round(amt)
        else if (p.type === 'mineral') out.min += Math.round(amt)
        else if (p.type === 'food') out.food += Math.round(amt)
        else if (p.type === 'energy') out.energy += Math.round(amt)
      }
    }
    return out
  }, [player.ownedBuildings, selectedPlanet])


  return (
    <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text font-sans">
      {/* Header */}
      <header className="bg-pink-nebula-panel px-6 py-4 flex items-center justify-between border-b border-pink-nebula-border">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-wide">Infinite Conflict</span>
          <nav className="flex gap-2">
            {planets.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlanetId(p.id)}
                className={`px-3 py-1 rounded ${selectedPlanetId === p.id ? 'bg-pink-nebula-accent-primary text-pink-nebula-text' : 'text-pink-nebula-muted'}`}
              >
                {p.name}
              </button>
            ))}
            <button className="px-3 py-1 rounded border border-pink-nebula-border text-pink-nebula-muted">+</button>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          {/* Resource summary placeholder */}
          <span className="text-pink-nebula-muted">Resources: M {player.resources.mass} Mi {player.resources.mineral} F {player.resources.food} E {player.resources.energy}</span>
        </div>
      </header>

      {/* Main grid layout */}
      <main className="max-w-7xl mx-auto grid grid-cols-[280px_1fr_320px] gap-8 py-8">
        {/* Left column: Owned Buildings List */}
        <aside className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4 flex flex-col">
          <h2 className="text-lg font-bold mb-4">Buildings</h2>
          <div className="flex flex-col gap-2">
            {/* Always show these buildings for the selected planet */}
            {['Outpost', 'Metal Mine', 'Metal Mine', 'Metal Mine', 'Mineral Extractor', 'Mineral Extractor', 'Mineral Extractor', 'Farm', 'Solar Generator'].map((name, idx) => (
              <div key={name + idx} className="flex items-center gap-3 p-2 rounded bg-pink-nebula-bg border border-pink-nebula-border">
                {/* Placeholder for icon */}
                <div className="w-8 h-8 bg-pink-nebula-panel rounded" />
                <div>
                  <div className="text-pink-nebula-text font-semibold">{name}</div>
                  {/* Output/consumption placeholder */}
                  <div className="text-pink-nebula-muted text-xs">+Output / -Consumption</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Middle column: Build Queue (single section) */}
        <section className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4 flex flex-col">
          <div className="flex items-center gap-4 mb-4">
          </div>
            <h2 className="text-lg font-bold">Build Queue</h2>
            {/* Tabs for production */}
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded bg-pink-nebula-accent-primary text-pink-nebula-text">Colonists</button>
              <button className="px-3 py-1 rounded text-pink-nebula-muted border border-pink-nebula-border">Ships</button>
            </div>

          {/* Current queue (top) and currently building item with remaining turns */}
          <div className="mb-4">
            <div className="text-pink-nebula-muted font-semibold mb-1">Current Queue</div>
            <div className="flex flex-col gap-2">
              {/* Example: show one item as currently building, rest as queued */}
              <div className="flex items-center gap-3 p-2 rounded bg-pink-nebula-bg border border-pink-nebula-border">
                <div className="w-8 h-8 bg-pink-nebula-panel rounded" />
                <div>
                  <div className="text-pink-nebula-text font-semibold">Metal Mine</div>
                  <div className="text-pink-nebula-muted text-xs">Building... 3 turns left</div>
                </div>
              </div>
              {/* Queued items placeholder */}
              <div className="flex items-center gap-3 p-2 rounded bg-pink-nebula-bg border border-pink-nebula-border">
                <div className="w-8 h-8 bg-pink-nebula-panel rounded" />
                <div>
                  <div className="text-pink-nebula-text font-semibold">Farm</div>
                  <div className="text-pink-nebula-muted text-xs">Queued</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right column: Planet Summary */}
        <aside className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4 flex flex-col">
          <h2 className="text-lg font-bold mb-4">Planet Summary</h2>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-pink-nebula-muted">
                <th className="text-left">Resource</th>
                <th className="text-right">Stored</th>
                <th className="text-right">Output</th>
                <th className="text-right">Abundance</th>
              </tr>
            </thead>
            <tbody>
              {planetSummaryRows.map(r => (
                <tr key={r.id}>
                  <td className={r.color}>{r.label}</td>
                  <td className="text-right">{r.stored}</td>
                  <td className="text-right">{r.output}</td>
                  <td className="text-right">{r.abundance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Space and meta info placeholder */}
          <div className="text-pink-nebula-muted">Space: 20K/50K</div>
        </aside>

      </main>
    </div>
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
    const used = { name: name.trim(), metal: Number(metal), mineral: Number(mineral), food: Number(food) }
    onAdd(used.name, used.metal, used.mineral, used.food)
    debugLog('AddPlanetForm.submit', used)
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

function AddQueueItemForm({ onAdd }: { onAdd: (itemId: string, itemType: 'structure' | 'unit', count: number) => void }) {
  const availableUnits = GameData.getAllUnits() as GUnit[]
  const availableStructures = GameData.getAllStructures() as GStructure[]
  const allItems = [...availableStructures.map((s:GStructure)=>({id:s.id, label:s.name, type:'structure'})), ...availableUnits.map((u:GUnit)=>({id:u.id, label:u.name, type:'unit'}))]
  const [item, setItem] = useState(allItems[0]?.id || '')
  const [count, setCount] = useState(1)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!item) return
    const found = allItems.find(ai => ai.id === item)
    const type = (found && (found as any).type) || 'unit'
    const used = { item, type: type as 'structure' | 'unit', count: Number(count) }
    onAdd(used.item, used.type, used.count)
    debugLog('AddQueueItemForm.submit', used)
    setCount(1)
  }

  return (
    <form className="flex gap-2 items-center" onSubmit={submit}>
      <select value={item} onChange={e => setItem(e.target.value)} className="px-2 py-1 border rounded">
        {allItems.map(c => (
          <option key={c.id} value={c.id}>{c.label} {c.type === 'structure' ? '(Structure)' : ''}</option>
        ))}
      </select>
      <input type="number" value={count} min={1} onChange={e => setCount(Number(e.target.value))} className="w-24 px-2 py-1 border rounded" />
      <button className="px-3 py-1 rounded border" type="submit">Queue</button>
    </form>
  )
}
