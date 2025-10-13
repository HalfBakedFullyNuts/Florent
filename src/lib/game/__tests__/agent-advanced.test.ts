import { describe, it, expect, vi } from 'vitest'
import GameData from '../dataManager'
import {
  enqueueItem,
  processTick,
  completeQueueItem,
  moveQueueItemGlobal,
  validateRequirements,
} from '../agent'
import type { PlayerState, QueueItem } from '../types'

const makePlayer = (): PlayerState => ({
  resources: { mass: 0, mineral: 0, food: 0, energy: 0 },
  income: { mass: 0, mineral: 0, food: 0, energy: 0 },
  ownedBuildings: [],
  completedResearch: [],
  buildQueue: [],
  unitQueueByFactory: {},
  unitCounts: {},
  tick: 0,
  meta: {},
})

describe('agent advanced behaviors', () => {
  it('validateRequirements passes when research flags are satisfied', () => {
    const player = makePlayer()
    player.completedResearch.push('hyperdrive')

    const result = validateRequirements(player, [{ type: 'research_flag', id: 'hyperdrive' }])
    expect(result.ok).toBe(true)
  })

  it('refunds energy when multi-count enqueueItem runs out mid-loop', () => {
    const player = makePlayer()
    player.resources.energy = 800

    const original = GameData.getStructureById
    const structureSpy = vi.spyOn(GameData, 'getStructureById').mockImplementation((id: string) => {
      if (id === 'energy_tower') {
        return {
          id: 'energy_tower',
          name: 'Energy Tower',
          cost: [{ type: 'resource', id: 'energy', amount: 600 }],
          build_time_turns: 3,
        } as any
      }
      return original.call(GameData, id)
    })

    const res = enqueueItem(player, 'energy_tower', 'structure', 2)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('Insufficient resources')
    expect(player.resources.energy).toBe(800)
    expect(player.buildQueue.length).toBe(0)

    structureSpy.mockRestore()
  })

  it('processTick applies consumption, abundance scaling, and unit production', () => {
    const player = makePlayer()
    player.resources = { mass: 10, mineral: 10, food: 10, energy: 10 }
    player.unitCounts = { worker: 1 }
    player.ownedBuildings = [{ id: 'b1', name: 'reactor', builtAtTick: 0 }]

    const original = GameData.getStructureById
    const structureSpy = vi.spyOn(GameData, 'getStructureById').mockImplementation((id: string) => {
      if (id === 'reactor') {
        return {
          id: 'reactor',
          name: 'Reactor',
          operations: {
            consumption: [
              { type: 'resource', id: 'energy', amount: 5 },
              { type: 'resource', id: 'metal', amount: 2 },
              { type: 'resource', id: 'mineral', amount: 1 },
              { type: 'resource', id: 'food', amount: 3 },
            ],
            production: [
              { type: 'metal', base_amount: 4, is_abundance_scaled: true },
              { type: 'mineral', base_amount: 2 },
              { type: 'food', base_amount: 1, is_abundance_scaled: true },
              { type: 'worker', base_amount: 2.4 },
            ],
          },
        } as any
      }
      return original.call(GameData, id)
    })

    processTick(
      player,
      { metal: 1.5, mineral: 1, food: 2 },
      1,
    )

    expect(player.resources.energy).toBe(10)
    expect(player.resources.mass).toBe(14) // 10 - 2 + round(4 * 1.5) => 10 - 2 + 6
    expect(player.resources.mineral).toBe(11) // 10 - 1 + 2
    expect(player.resources.food).toBe(9) // 10 - 3 + round(1 * 2)
    expect(player.unitCounts?.worker).toBe(3) // floor(2.4) + existing 1

    structureSpy.mockRestore()
  })

  it('moveQueueItemGlobal reorders items across indices', () => {
    const player = makePlayer()
    player.buildQueue = [
      { id: 'a', name: 'A', type: 'Building', remainingTime: 1, massReserved: 0, energyReserved: 0 } as QueueItem,
      { id: 'b', name: 'B', type: 'Building', remainingTime: 1, massReserved: 0, energyReserved: 0 } as QueueItem,
      { id: 'c', name: 'C', type: 'Building', remainingTime: 1, massReserved: 0, energyReserved: 0 } as QueueItem,
    ]

    const { ok } = moveQueueItemGlobal(player, 'c', 1)
    expect(ok).toBe(true)
    expect(player.buildQueue[1].id).toBe('c')
    expect(player.buildQueue.map(q => q.id)).toEqual(['a', 'c', 'b'])
  })

  it('completeQueueItem applies structure/unit effects and updates meta', () => {
    const player = makePlayer()
    player.meta = { attr_morale: 2 }

    const structureDef = {
      id: 'colony_hub',
      name: 'Colony Hub',
      operations: {
        effects: [
          { type: 'PROVIDE_HOUSING', category: 'worker', amount: 5 },
          { type: 'UNLOCK_CATEGORY', category: 'colonist' },
          { type: 'MODIFY_ATTRIBUTE', attribute: 'morale', value: 3 },
          { type: 'ENABLE_ACTION', action: 'terraform' },
        ],
      },
    }

    const unitDef = {
      id: 'sentinel',
      name: 'Sentinel',
      operations: {
        effects: [{ type: 'ENABLE_ACTION', action: 'defend' }],
      },
    }

    const originalStructure = GameData.getStructureById
    const structureSpy = vi.spyOn(GameData, 'getStructureById').mockImplementation((id: string) => {
      if (id === 'colony_hub') return structureDef as any
      return originalStructure.call(GameData, id)
    })

    const originalUnit = GameData.getUnitById
    const unitSpy = vi.spyOn(GameData, 'getUnitById').mockImplementation((id: string) => {
      if (id === 'sentinel') return unitDef as any
      return originalUnit.call(GameData, id)
    })

    const structureItem: QueueItem = {
      id: 's1',
      name: 'colony_hub',
      type: 'Building',
      remainingTime: 0,
      massReserved: 0,
      energyReserved: 0,
      meta: { itemType: 'structure' },
    }

    player.buildQueue = [structureItem]
    completeQueueItem(player, structureItem)

    expect(player.ownedBuildings.find(b => b.id === 's1')?.name).toBe('colony_hub')
    expect(player.meta?.housing_worker).toBe(5)
    expect(player.meta?.unlocked_colonist).toBe(true)
    expect(player.meta?.attr_morale).toBe(5)
    expect(player.meta?.action_terraform).toBe(true)

    const unitItem: QueueItem = {
      id: 'u1',
      name: 'sentinel',
      type: 'Unit',
      remainingTime: 0,
      massReserved: 0,
      energyReserved: 0,
      meta: { itemType: 'unit' },
    }

    player.buildQueue = [unitItem]
    completeQueueItem(player, unitItem)

    expect(player.unitCounts?.sentinel).toBe(1)
    expect(player.meta?.action_defend).toBe(true)

    structureSpy.mockRestore()
    unitSpy.mockRestore()
  })

  it('research lab provides scientist housing when completed', () => {
    const player = makePlayer()
    player.resources = { mass: 100000, mineral: 100000, food: 100000, energy: 100000 }
    player.unitCounts = { worker: 200000 }
    player.ownedBuildings.push({ id: 'colony-test', name: 'colony', builtAtTick: 0 })

    const res = enqueueItem(player, 'research_lab', 'structure', 1)
    expect(res.ok).toBe(true)

    while (player.buildQueue.length > 0) {
      processTick(player, { metal: 1, mineral: 1, food: 1 }, 1)
    }

    expect(player.meta?.housing_scientist).toBe(25000)
  })

  it('army barracks provides updated soldier housing capacity', () => {
    const player = makePlayer()
    player.resources = { mass: 100000, mineral: 100000, food: 100000, energy: 100000 }
    player.unitCounts = { worker: 200000 }
    player.ownedBuildings.push({ id: 'colony-test', name: 'colony', builtAtTick: 0 })
    player.ownedBuildings.push({ id: 'lwf-test', name: 'light_weapons_factory', builtAtTick: 0 })

    const res = enqueueItem(player, 'army_barracks', 'structure', 1)
    expect(res.ok).toBe(true)

    while (player.buildQueue.length > 0) {
      processTick(player, { metal: 1, mineral: 1, food: 1 }, 1)
    }

    expect(player.meta?.housing_soldier).toBe(250000)
  })
})
