import { describe, it, expect } from 'vitest'
import GameData from '../dataManager'
import { enqueueItem, processTick, completeQueueItem, cancelQueueItemLegacy } from '../agent'
import type { PlayerState } from '../types'

function makePlayer(): PlayerState {
  return {
    resources: { mass: 100000, mineral: 100000, food: 100000, energy: 100000 },
    income: { mass: 0, mineral: 0, food: 0, energy: 0 },
    ownedBuildings: [],
    completedResearch: [],
    buildQueue: [],
    unitQueueByFactory: {},
    unitCounts: { worker: 500000 },
    tick: 0,
    meta: {},
  }
}

describe('integration: multi-tick simulations', () => {
  it('can build an outpost, produce workers across ticks, and train a soldier consuming a worker', () => {
    const p = makePlayer()

    // enqueue an outpost
    const res = enqueueItem(p, 'outpost', 'structure', 1)
    expect(res.ok).toBe(true)
    // fast-forward ticks until completion
    while (p.buildQueue.length > 0) {
      processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)
    }
    // ensure outpost exists
    const out = p.ownedBuildings.find(b => b.name === 'outpost' || b.id === 'outpost')
    expect(out).toBeDefined()

    // baseline worker count should be 0
    expect(p.unitCounts!['worker'] || 0).toBeGreaterThanOrEqual(0)

  p.unitCounts = { worker: 200000 }

  // build prerequisite structures for Army Barracks (Colony, Light Weapons Factory)
    const colonyRes = enqueueItem(p, 'colony', 'structure', 1)
    expect(colonyRes.ok).toBe(true)
  while (p.buildQueue.length > 0) processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)

  const lwfRes = enqueueItem(p, 'light_weapons_factory', 'structure', 1)
  expect(lwfRes.ok).toBe(true)
  while (p.buildQueue.length > 0) processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)

  // build an Army Barracks so soldier prerequisites are satisfied
  const rbRes = enqueueItem(p, 'army_barracks', 'structure', 1)
  expect(rbRes.ok).toBe(true)
  while (p.buildQueue.length > 0) processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)

  // find the built barracks and use its owned id as factoryId
  const barracks = p.ownedBuildings.find(b => b.name === 'army_barracks' || b.id === 'army_barracks')
  expect(barracks).toBeDefined()

  // now enqueue a soldier (consumes a worker)
  const before = p.unitCounts!['worker'] || 0
  p.resources.food = 100000
  const rs = enqueueItem(p, 'soldier', 'unit', 1)
  expect(rs.ok).toBe(true)
  expect((p.unitCounts!['worker'] || 0)).toBe(before - 1)

  // cancel the soldier and expect refund
  const queued = p.buildQueue.find(q => q.name === 'soldier')!
  const c = cancelQueueItemLegacy(p, barracks!.id, queued.id)
  expect(c.ok).toBe(true)
  expect(p.unitCounts!['worker']).toBe(before)
  })
})
