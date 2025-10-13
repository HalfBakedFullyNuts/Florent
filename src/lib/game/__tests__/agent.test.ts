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
  cancelQueueItemImpl,
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

const makeBasePlayer = (): PlayerState => ({
  resources: { mass: 30000, mineral: 20000, food: 10000, energy: 1000 },
  income: { mass: 0, mineral: 0, food: 0, energy: 0 },
  ownedBuildings: [
    { id: 'outpost-0', name: 'outpost', builtAtTick: 0 },
    { id: 'metal_mine-0', name: 'metal_mine', builtAtTick: 0 },
    { id: 'metal_mine-1', name: 'metal_mine', builtAtTick: 0 },
    { id: 'metal_mine-2', name: 'metal_mine', builtAtTick: 0 },
    { id: 'mineral_extractor-0', name: 'mineral_extractor', builtAtTick: 0 },
    { id: 'mineral_extractor-1', name: 'mineral_extractor', builtAtTick: 0 },
    { id: 'mineral_extractor-2', name: 'mineral_extractor', builtAtTick: 0 },
    { id: 'farm-0', name: 'farm', builtAtTick: 0 },
    { id: 'solar_generator-0', name: 'solar_generator', builtAtTick: 0 },
  ],
  completedResearch: [],
  buildQueue: [],
  unitQueueByFactory: {},
  unitCounts: { worker: 30000, soldier: 0, scientist: 0 },
  tick: 0,
  meta: {
    housing_worker: 50000,
    housing_soldier: 100000,
    ground_space_used: 9,
    ground_space_max: 60,
    orbital_space_used: 0,
    orbital_space_max: 40,
  },
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

  it('processTick advances the build queue sequentially turn by turn', () => {
    const p = makePlayer()
    p.buildQueue.push({ id: 'q1', name: 'Test', type: 'Building', remainingTime: 5, massReserved: 0, energyReserved: 0, meta: { itemType: 'structure' } } as any)
    processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)
    let rem = p.buildQueue.find(b => b.id === 'q1')!.remainingTime
    expect(rem).toBe(4)

    processTick(p, { metal: 1, mineral: 1, food: 1 }, 4)
    expect(p.buildQueue.find(b => b.id === 'q1')).toBeUndefined()
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

    // with sufficient workers and positive food, percent-based growth increases population
    p.ownedBuildings = [{ id: 'o1', name: 'outpost', builtAtTick: 0 }]
    p.unitCounts = { worker: 1000 }
    p.resources.food = 5000
    processTick(p, { metal: 1, mineral: 1, food: 1 }, 1)
    expect(p.unitCounts['worker']).toBeGreaterThan(1000)
  })

  it('automatically inserts wait items when resources will accumulate later', () => {
    const player: PlayerState = {
      resources: { mass: 0, mineral: 0, food: 1000, energy: 500 },
      income: { mass: 0, mineral: 0, food: 0, energy: 0 },
      ownedBuildings: [
        { id: 'op1', name: 'outpost', builtAtTick: 0 },
        { id: 'sg1', name: 'solar_generator', builtAtTick: 0 },
      ],
      completedResearch: [],
      buildQueue: [],
      unitQueueByFactory: {},
      unitCounts: { worker: 30000 },
      tick: 0,
    }

    const res = enqueueItem(player, 'living_quarters', 'structure', 1, { allowAutoWait: true })
    expect(res.ok).toBe(true)
    expect(player.buildQueue.length).toBeGreaterThanOrEqual(2)
    const waitEntry = player.buildQueue[0]
    const buildEntry = player.buildQueue[1]
    expect(waitEntry.type).toBe('Wait')
    expect(buildEntry.meta?.deferCost).toBe(true)
    expect(buildEntry.meta?.costPaid).toBe(false)

    const waitTurns = waitEntry.remainingTime
    processTick(player, { metal: 1, mineral: 1, food: 1 }, waitTurns)
    // wait entry should be removed after the simulated ticks
    expect(player.buildQueue[0]?.name).toBe('living_quarters')

    // advance additional turns to complete the build
    processTick(player, { metal: 1, mineral: 1, food: 1 }, 10)
    expect(player.buildQueue.find(q => q.name === 'living_quarters')).toBeUndefined()
    // cost should have been deducted once resources were available
    expect(player.resources.mass).toBeGreaterThanOrEqual(0)
  })

  it('fails to queue population costs when growth cannot cover deficit', () => {
    const player: PlayerState = {
      resources: { mass: 1000, mineral: 1000, food: 1000, energy: 500 },
      income: { mass: 0, mineral: 0, food: 0, energy: 0 },
      ownedBuildings: [
        { id: 'barracks-1', name: 'army_barracks', builtAtTick: 0 },
        { id: 'op1', name: 'outpost', builtAtTick: 0 },
      ],
      completedResearch: [],
      buildQueue: [],
      unitQueueByFactory: {},
      unitCounts: { worker: 0 },
      tick: 0,
    }

    const res = enqueueItem(player, 'soldier', 'unit', 1, { allowAutoWait: true })
    expect(res.ok).toBe(false)
  })

  it('removing a prerequisite also removes dependent queued items', () => {
    const player: PlayerState = {
      resources: { mass: 500000, mineral: 500000, food: 0, energy: 0 },
      income: { mass: 0, mineral: 0, food: 0, energy: 0 },
      ownedBuildings: [],
      completedResearch: [],
      buildQueue: [],
      unitQueueByFactory: {},
      unitCounts: { worker: 500000 },
      tick: 0,
    }

    const launchRes = enqueueItem(player, 'launch_site', 'structure', 1)
    expect(launchRes.ok).toBe(true)
    const shipRes = enqueueItem(player, 'ship_yard', 'structure', 1)
    expect(shipRes.ok).toBe(true)

    const launchItem = player.buildQueue.find(item => item.name === 'launch_site')
    expect(launchItem).toBeDefined()
    if (!launchItem) throw new Error('launch site not found in queue')

    const cancelRes = cancelQueueItemImpl(player, launchItem.id)
    expect(cancelRes.ok).toBe(true)
    expect(player.buildQueue.find(item => item.name === 'ship_yard')).toBeUndefined()
  })

  it('population consumption reduces food stocks over time', () => {
    const player: PlayerState = {
      resources: { mass: 0, mineral: 0, food: 1000, energy: 0 },
      income: { mass: 0, mineral: 0, food: 0, energy: 0 },
      ownedBuildings: [],
      completedResearch: [],
      buildQueue: [],
      unitQueueByFactory: {},
      unitCounts: { worker: 10000 },
      tick: 0,
      meta: {},
    }

    processTick(player, { metal: 1, mineral: 1, food: 1 }, 1)
    const afterOne = player.resources.food
    expect(afterOne).toBeLessThan(1000)

    processTick(player, { metal: 1, mineral: 1, food: 1 }, 4)
    expect(player.resources.food).toBeLessThan(afterOne)
  })

  it('prevents population growth when food income is negative and stocks depleted', () => {
    const player: PlayerState = {
      resources: { mass: 0, mineral: 0, food: 50, energy: 0 },
      income: { mass: 0, mineral: 0, food: 0, energy: 0 },
      ownedBuildings: [
        { id: 'metal_mine-0', name: 'metal_mine', builtAtTick: 0 },
        { id: 'mineral_extractor-0', name: 'mineral_extractor', builtAtTick: 0 },
        { id: 'solar_generator-0', name: 'solar_generator', builtAtTick: 0 },
      ],
      completedResearch: [],
      buildQueue: [],
      unitQueueByFactory: {},
      unitCounts: { worker: 5000 },
      tick: 0,
      meta: {},
    }

    const initialWorkers = player.unitCounts.worker
    processTick(player, { metal: 1, mineral: 1, food: 0.5 }, 10)
    expect(player.unitCounts?.worker).toBe(initialWorkers)
    expect(player.resources.food).toBe(0)
  })

  it('auto wait suggestions account for existing stocks and production', () => {
    const player = makeBasePlayer()
    const launch = enqueueItem(player, 'launch_site', 'structure', 1)
    expect(launch.ok).toBe(true)

    const result = enqueueItem(player, 'ship_yard', 'structure', 1, { allowAutoWait: true })
    expect(result.ok).toBe(true)

    const waitEntry = player.buildQueue.find(item => item.type === 'Wait' && item.meta?.waitFor)
    const shipEntry = player.buildQueue.find(item => item.name === 'ship_yard')
    expect(waitEntry).toBeDefined()
    expect(shipEntry).toBeDefined()
    expect(waitEntry?.meta?.waitFor).toBe(shipEntry?.id)
    expect(waitEntry?.remainingTime).toBe(20)
  })

  it('cancelQueueItemImpl refunds queued structure costs', () => {
    const player = makeBasePlayer()
    const beforeMass = player.resources.mass
    const beforeMineral = player.resources.mineral

    const res = enqueueItem(player, 'metal_mine', 'structure', 1)
    expect(res.ok).toBe(true)
    const entry = player.buildQueue.find(item => item.name === 'metal_mine')
    if (!entry) throw new Error('metal mine not queued')

    const cancelRes = cancelQueueItemImpl(player, entry.id)
    expect(cancelRes.ok).toBe(true)
    expect(player.resources.mass).toBe(beforeMass)
    expect(player.resources.mineral).toBe(beforeMineral)
  })

  it('energy upkeep does not reduce stored energy', () => {
    const player = makeBasePlayer()
    player.resources.energy = 50
    player.ownedBuildings = player.ownedBuildings.filter(b => b.name !== 'solar_generator')

    processTick(player, { metal: 1, mineral: 1, food: 1 }, 5)
    expect(player.resources.energy).toBe(50)
  })
})
