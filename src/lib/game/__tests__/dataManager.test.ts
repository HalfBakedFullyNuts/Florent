import { describe, it, expect, vi } from 'vitest'
import GameData from '../dataManager'

const validMockData = {
  meta: { version: 'test', description: 'mock dataset' },
  resources: [{ id: 'metal', name: 'Metal' }],
  units: [
    {
      id: 'worker',
      name: 'Worker',
      cost: [],
      requirements: [],
    },
  ],
  structures: [
    {
      id: 'outpost',
      name: 'Outpost',
      cost: [{ type: 'resource', id: 'metal', amount: 100 }],
      requirements: [],
      operations: {
        production: [{ type: 'metal', base_amount: 5 }],
        consumption: [{ type: 'resource', id: 'energy', amount: 1 }],
      },
    },
  ],
}

async function loadGameData(mockData: unknown) {
  vi.resetModules()
  vi.doMock('../game_data.json', () => ({ default: mockData }), { virtual: true })
  try {
    return await import('../dataManager')
  } finally {
    vi.doUnmock('../game_data.json')
  }
}

describe('GameDataService', () => {
  it('loads valid game data and exposes lookup helpers', async () => {
    const { default: GameData } = await loadGameData(validMockData)

    expect(GameData.getMeta()).toEqual(validMockData.meta)
    expect(GameData.getAllUnits()).toHaveLength(1)
    expect(GameData.getAllStructures()).toHaveLength(1)

    const unit = GameData.getUnitById('worker')
    expect(unit?.name).toBe('Worker')
    expect(GameData.getUnitById('missing')).toBeNull()

    const structure = GameData.getStructureById('outpost')
    expect(structure?.operations?.production?.[0].type).toBe('metal')
    expect(GameData.getStructureById('missing')).toBeNull()

    expect(GameData.getResourceById('metal')).toEqual({ id: 'metal', name: 'Metal' })
    expect(GameData.getResourceById('energy')).toBeNull()
  })

  it('fails fast when resource entries are malformed', async () => {
    const badResources = {
      ...validMockData,
      resources: [{ name: 'Metal' }],
    }

    await expect(loadGameData(badResources)).rejects.toThrow('[GameDataValidation] resources[0].id must be a non-empty string')
  })

  it('fails when structure operations use invalid shapes', async () => {
    const badStructureOperations = {
      ...validMockData,
      structures: [
        {
          id: 'broken',
          name: 'Broken Structure',
          operations: { production: [], consumption: {} },
        },
      ],
    }

    await expect(loadGameData(badStructureOperations)).rejects.toThrow('[GameDataValidation] structures[0].operations.consumption must be an array if present')
  })

  it('provides freighter cargo capacity and worker requirements', () => {
    const freighter = GameData.getUnitById('freighter')
    expect(freighter?.build_requirements?.workers_occupied).toBe(20000)
    const capacities = freighter?.cargo_capacity || []
    const metalCap = capacities.find((c: any) => c.id === 'metal') as any
    const mineralCap = capacities.find((c: any) => c.id === 'mineral') as any
    const groupCap = capacities.find((c: any) => (c.ids || []).includes('worker')) as any
    expect(metalCap?.amount).toBe(120000)
    expect(mineralCap?.amount).toBe(80000)
    expect(groupCap?.amount).toBe(40000)
  })
})
