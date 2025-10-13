import { describe, it, expect, vi } from 'vitest'
import GameData from '../dataManager'
import { completeQueueItem } from '../agent'
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

describe('effects application', () => {
  it('INCREASE_SPACE updates ground/orbital capacities', () => {
    const player = makePlayer()

    const structureDef = {
      id: 'spacer',
      name: 'Spacer',
      operations: {
        effects: [
          { type: 'INCREASE_SPACE', space_type: 'ground', amount: 2 },
          { type: 'INCREASE_SPACE', space_type: 'orbital', amount: 3 },
        ],
      },
    }

    const original = GameData.getStructureById
    const spy = vi.spyOn(GameData, 'getStructureById').mockImplementation((id: string) => {
      if (id === 'spacer') return structureDef as any
      return original.call(GameData, id)
    })

    const qi: QueueItem = {
      id: 'q1',
      name: 'spacer',
      type: 'Building',
      remainingTime: 0,
      massReserved: 0,
      energyReserved: 0,
      meta: { itemType: 'structure' },
    }
    player.buildQueue = [qi]
    completeQueueItem(player, qi)

    expect(player.meta?.ground_space_max).toBe(2)
    expect(player.meta?.orbital_space_max).toBe(3)
    spy.mockRestore()
  })

  it('unknown effects are ignored gracefully', () => {
    const player = makePlayer()

    const structureDef = {
      id: 'mystery',
      name: 'Mystery',
      operations: {
        effects: [
          { type: 'UNKNOWN_EFFECT', foo: 'bar' },
        ],
      },
    }

    const original = GameData.getStructureById
    const spy = vi.spyOn(GameData, 'getStructureById').mockImplementation((id: string) => {
      if (id === 'mystery') return structureDef as any
      return original.call(GameData, id)
    })

    const qi: QueueItem = {
      id: 'q2',
      name: 'mystery',
      type: 'Building',
      remainingTime: 0,
      massReserved: 0,
      energyReserved: 0,
      meta: { itemType: 'structure' },
    }
    player.buildQueue = [qi]
    // should not throw
    completeQueueItem(player, qi)
    expect(player.meta).toBeDefined()
    spy.mockRestore()
  })
})

