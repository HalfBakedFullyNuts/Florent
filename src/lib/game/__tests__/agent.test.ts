import { describe, it, expect } from 'vitest'
import {
  validatePrereqs,
  enqueueUnit,
  cancelQueueItem,
  processTick,
  moveQueueItem,
  completeQueueItem,
  enqueueItem,
  cancelQueueItemLegacy,
} from '../agent'
import type { PlayerState } from '../types'

const makePlayer = (): PlayerState => ({
  resources: { mass: 1000, mineral: 0, food: 0, energy: 500 },
  income: { mass: 10, mineral: 0, food: 0, energy: 5 },
  ownedBuildings: [{ id: 'fac1', name: 'Army Barracks', builtAtTick: 0 }],
  completedResearch: [],
  buildQueue: [],
  unitQueueByFactory: {},
  tick: 0,
})

describe('agent expanded behavior', () => {
  it('validatePrereqs fails when missing building or research', () => {
    const p = makePlayer()
    const res1 = validatePrereqs(p, [{ type: 'Building', name: 'Nonexistent' } as any])
    expect(res1.ok).toBe(false)
    const res2 = validatePrereqs(p, [{ type: 'Research', name: 'Advanced Tech' } as any])
    expect(res2.ok).toBe(false)
  })

  it('enqueue fails when factory not owned or insufficient resources', () => {
    const p = makePlayer()
    const unit = { id: 'u1', name: 'Soldier', type: 'Infantry', cost: { mass: 1200, energy: 0, time: 4 }, prerequisites: [] } as any
    // factory not owned
    const r1 = enqueueUnit(p, 'missing-factory', unit, 1)
    expect(r1.ok).toBe(false)
    // factory exists but insufficient resources
    const r2 = enqueueUnit(p, 'fac1', unit, 1)
    expect(r2.ok).toBe(false)
  })

  it('enqueue and cancel reserves and refunds resources and supports multiple factories', () => {
    const p = makePlayer()
    // add second factory
    p.ownedBuildings.push({ id: 'fac2', name: 'Army Barracks', builtAtTick: 0 })
    const unit = { id: 'u2', name: 'Soldier', type: 'Infantry', cost: { mass: 12, energy: 0, time: 4 }, prerequisites: [{ type: 'Building', name: 'Army Barracks' }] } as any
    const r = enqueueUnit(p, 'fac1', unit, 2)
    expect(r.ok).toBe(true)
    // reserve from fac1
    expect(p.resources.mass).toBe(1000 - 24)
    // enqueue one in fac2
    const r3 = enqueueUnit(p, 'fac2', unit, 1)
    expect(r3.ok).toBe(true)
    expect(p.resources.mass).toBe(1000 - 36)

    // move an item in fac1 queue
    const q1 = p.unitQueueByFactory['fac1']
    expect(q1.length).toBe(2)
    const idToMove = q1[0].id
    const mv = moveQueueItem(p, 'fac1', idToMove, 1)
    expect(mv.ok).toBe(true)

    // cancel one item from fac1 and check refund
    const cancel = cancelQueueItem(p, 'fac1', q1[0].id)
    expect(cancel.ok).toBe(true)
    // mass refunded by 12
    expect(p.resources.mass).toBe(1000 - 24)
  })

  it('completeQueueItem adds building and research results to player state', () => {
    const p = makePlayer()
    // create a building queue item
    const bq: any = { id: 'bq1', name: 'T1 Mass Extractor', type: 'Building', remainingTime: 0, massReserved: 100, energyReserved: 0 }
    p.buildQueue.push(bq)
    completeQueueItem(p, bq)
    expect(p.ownedBuildings.find(b => b.id === 'bq1')).toBeDefined()

    // research
    const rq: any = { id: 'rq1', name: 'Basic Research', type: 'Research', remainingTime: 0, massReserved: 0, energyReserved: 0 }
    p.buildQueue.push(rq)
    completeQueueItem(p, rq)
    expect(p.completedResearch.includes('Basic Research')).toBe(true)
  })

  it('processTick decreases remainingTime normally and respects stalling lower bound', () => {
    const p = makePlayer()
  p.buildQueue.push({ id: 'q1', name: 'Test', type: 'Unit', remainingTime: 5, massReserved: 0, energyReserved: 0 } as any)
  processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)
    let rem = p.buildQueue.find(b => b.id === 'q1')!.remainingTime
    expect(rem).toBeCloseTo(4, 5)

    // strong negative energy -> stallingFactor lower bounded (>= 0.1)
  p.buildQueue = [{ id: 'q2', name: 'Test2', type: 'Unit', remainingTime: 10, massReserved: 0, energyReserved: 0 } as any]
    p.income.energy = -2000
  processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)
    const r2 = p.buildQueue.find(b => b.id === 'q2')!.remainingTime
    // stalling should at least subtract 0.1
    expect(r2).toBeLessThan(10)
    expect(r2).toBeGreaterThan(9)
  })

  it('unit enqueue consumes worker units and cancel refunds them; structures produce units over time', () => {
    const p = makePlayer()
    // initialize unitCounts and give player some workers
    p.unitCounts = { worker: 2 }

    // attempt to enqueue a soldier by legacy enqueueUnit (which uses mass reservation)
    const soldierDef: any = { id: 'soldier', name: 'Soldier', cost: { mass: 0 }, prerequisites: [] }
    // legacy enqueueUnit requires factory ownership
    p.ownedBuildings = [{ id: 'b1', name: 'Army Barracks', builtAtTick: 0 }]
    const r = enqueueUnit(p, 'b1', soldierDef, 1)
    // legacy function will deduct mass if configured; since mass cost is 0 it should succeed
    expect(r.ok).toBe(true)

  // Now test data-driven enqueue: use enqueueItem to queue a soldier which consumes a worker
  // ensure worker count and resources are sufficient
  p.unitCounts = { worker: 1 }
  p.resources.food = 10000
  const r2 = enqueueItem(p, 'soldier', 'unit', 1)
    expect(r2.ok).toBe(true)
    // worker should have been consumed (is_consumed true in game_data.json)
    expect(p.unitCounts['worker']).toBe(0)

    // find queued soldier and cancel it, which should refund the consumed worker
    const q = p.buildQueue.find(qi => qi.name === 'soldier')
    expect(q).toBeDefined()
  expect(q).toBeDefined()
  if (!q) throw new Error('queued soldier not found')
  const cancel = cancelQueueItemLegacy(p, 'b1', q.id)
  expect(cancel.ok).toBe(true)
  expect(p.unitCounts['worker']).toBe(1)

    // test structure production: Outpost produces workers per tick
    p.ownedBuildings = [{ id: 'o1', name: 'outpost', builtAtTick: 0 }]
    p.unitCounts = { worker: 0 }
    processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)
    // outpost produces 200 workers per turn in game_data.json
    expect(p.unitCounts['worker']).toBeGreaterThanOrEqual(200)
  })
})
