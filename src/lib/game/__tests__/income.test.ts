import { describe, it, expect } from 'vitest'
import GameData from '../dataManager'
import { calculateIncome } from '../agent'
import type { PlayerState } from '../types'

describe('calculateIncome (engine)', () => {
  it('computes per-turn income and consumption from owned structures and population', () => {
    const player: PlayerState = {
      resources: { mass: 0, mineral: 0, food: 0, energy: 0 },
      income: { mass: 0, mineral: 0, food: 0, energy: 0 },
      ownedBuildings: [
        { id: 'mm-0', name: 'metal_mine', builtAtTick: 0 },
        { id: 'mm-1', name: 'metal_mine', builtAtTick: 0 },
        { id: 'mm-2', name: 'metal_mine', builtAtTick: 0 },
        { id: 'me-0', name: 'mineral_extractor', builtAtTick: 0 },
        { id: 'me-1', name: 'mineral_extractor', builtAtTick: 0 },
        { id: 'me-2', name: 'mineral_extractor', builtAtTick: 0 },
        { id: 'farm-0', name: 'farm', builtAtTick: 0 },
        { id: 'sg-0', name: 'solar_generator', builtAtTick: 0 },
      ],
      completedResearch: [],
      buildQueue: [],
      unitQueueByFactory: {},
      unitCounts: { worker: 30000, soldier: 0, scientist: 0 },
      tick: 0,
      meta: {},
    }

    // With abundances 1,1,1 and the dataset defaults, ensure no crash and numbers are finite.
    const abundances = { metal: 1, mineral: 1, food: 1 }
    const income = calculateIncome(player, abundances)
    expect(Number.isFinite(income.mass)).toBe(true)
    expect(Number.isFinite(income.mineral)).toBe(true)
    expect(Number.isFinite(income.food)).toBe(true)
    expect(Number.isFinite(income.energy)).toBe(true)

    // sanity checks: having three mines/extractors/farm should yield positive (or zero) mass/mineral/food deltas,
    // and solar generator should contribute positive energy; population reduces food per-turn.
    expect(income.mass).toBeGreaterThanOrEqual(0)
    expect(income.mineral).toBeGreaterThanOrEqual(0)
    // food may be negative due to population, but production exists too; just ensure it is a number.
    expect(typeof income.food).toBe('number')
    expect(income.energy).toBeGreaterThanOrEqual(0)
  })
})

