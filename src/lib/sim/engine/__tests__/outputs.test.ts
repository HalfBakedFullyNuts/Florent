/**
 * Tests for resource output calculations including population food upkeep
 */

import { describe, it, expect } from 'vitest';
import { computeNetOutputsPerTurn, calculatePopulationFoodUpkeep } from '../outputs';
import { setDefsCatalog, getDefs } from '../defsRegistry';
import { minimalState } from '../../../../test/fixtures/minimal';
import { cloneState } from '../helpers';
import type { PlanetState } from '../types';

describe('Food Economy with Population Upkeep', () => {
  it('should calculate correct population food upkeep', () => {
    const state = cloneState(minimalState);

    // Test with various population sizes
    state.population.workersTotal = 10000; // Should consume 10000 * 0.002 = 20 food
    expect(calculatePopulationFoodUpkeep(state)).toBe(20);

    state.population.workersTotal = 100000; // Should consume 200 food
    expect(calculatePopulationFoodUpkeep(state)).toBe(200);

    // Test with soldiers and scientists
    state.population.soldiers = 5000; // +10 food
    state.population.scientists = 2000; // +4 food
    expect(calculatePopulationFoodUpkeep(state)).toBe(214); // 200 + 10 + 4
  });

  it('should reduce food production by population upkeep in computeNetOutputsPerTurn', () => {
    const state = cloneState(minimalState);

    // Remove outpost to start with clean production
    state.completedCounts = {};

    // Add a farm that produces 100 food
    getDefs()['farm'] = {
      id: 'farm',
      name: 'Farm',
      type: 'structure',
      lane: 'building',
      durationTurns: 4,
      tier: 1,
      costsPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0, workers: 0, space: 0, space_orbital: 0 },
      effectsOnComplete: {
        production_food: 100,
      },
      isAbundanceScaled: true,
      upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
      prerequisites: [],
    };

    // Set food abundance to 1.0 (normal)
    state.abundance.food = 1.0;

    // Add 1 completed farm
    state.completedCounts['farm'] = 1;

    // Set population to 20,000 (40 food upkeep)
    state.population.workersTotal = 20000;

    const outputs = computeNetOutputsPerTurn(state);

    // Net food should be: 100 (farm production) - 40 (upkeep) = 60
    expect(outputs.food).toBe(60);
  });

  it('should allow negative food production when upkeep exceeds production', () => {
    const state = cloneState(minimalState);

    // Remove outpost to start with clean production
    state.completedCounts = {};

    // Add a farm that produces 50 food
    getDefs()['farm'] = {
      id: 'farm',
      name: 'Farm',
      type: 'structure',
      lane: 'building',
      durationTurns: 4,
      tier: 1,
      costsPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0, workers: 0, space: 0, space_orbital: 0 },
      effectsOnComplete: {
        production_food: 50,
      },
      isAbundanceScaled: false,
      upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
      prerequisites: [],
    };

    state.completedCounts['farm'] = 1;

    // Set population to 50,000 (100 food upkeep)
    state.population.workersTotal = 50000;

    const outputs = computeNetOutputsPerTurn(state);

    // Net food should be: 50 (production) - 100 (upkeep) = -50
    expect(outputs.food).toBe(-50);
  });

  it('should handle zero production with positive upkeep correctly', () => {
    const state = cloneState(minimalState);

    // Remove outpost to start with zero production
    state.completedCounts = {};

    // No farms, no food production
    state.population.workersTotal = 30000; // 60 food upkeep

    const outputs = computeNetOutputsPerTurn(state);

    // Net food should be: 0 (no production) - 60 (upkeep) = -60
    expect(outputs.food).toBe(-60);
  });

  it('should handle break-even scenario correctly', () => {
    const state = cloneState(minimalState);

    // Remove outpost to start with clean production
    state.completedCounts = {};

    // Add farms that produce exactly enough for upkeep
    getDefs()['farm'] = {
      id: 'farm',
      name: 'Farm',
      type: 'structure',
      lane: 'building',
      durationTurns: 4,
      tier: 1,
      costsPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0, workers: 0, space: 0, space_orbital: 0 },
      effectsOnComplete: {
        production_food: 100,
      },
      isAbundanceScaled: false,
      upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
      prerequisites: [],
    };

    state.completedCounts['farm'] = 2; // 200 food production
    state.population.workersTotal = 100000; // 200 food upkeep

    const outputs = computeNetOutputsPerTurn(state);

    // Net food should be: 200 (production) - 200 (upkeep) = 0
    expect(outputs.food).toBe(0);
  });

  it('should scale production with abundance but not upkeep', () => {
    const state = cloneState(minimalState);

    // Remove outpost to start with clean production
    state.completedCounts = {};

    // Add abundance-scaled farm
    getDefs()['farm'] = {
      id: 'farm',
      name: 'Farm',
      type: 'structure',
      lane: 'building',
      durationTurns: 4,
      tier: 1,
      costsPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0, workers: 0, space: 0, space_orbital: 0 },
      effectsOnComplete: {
        production_food: 100,
      },
      isAbundanceScaled: true,
      upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
      prerequisites: [],
    };

    state.completedCounts['farm'] = 1;
    state.population.workersTotal = 50000; // 100 food upkeep (not scaled)

    // Test with low abundance
    state.abundance.food = 0.5;
    let outputs = computeNetOutputsPerTurn(state);
    // Net food: (100 * 0.5) - 100 = 50 - 100 = -50
    expect(outputs.food).toBe(-50);

    // Test with high abundance
    state.abundance.food = 2.0;
    outputs = computeNetOutputsPerTurn(state);
    // Net food: (100 * 2.0) - 100 = 200 - 100 = 100
    expect(outputs.food).toBe(100);
  });

  it('should not deduct food upkeep from other resources', () => {
    const state = cloneState(minimalState);

    // Remove outpost to start with clean production
    state.completedCounts = {};

    // Add structures that produce metal and mineral
    getDefs()['metal_mine'] = {
      id: 'metal_mine',
      name: 'Metal Mine',
      type: 'structure',
      lane: 'building',
      durationTurns: 4,
      tier: 1,
      costsPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0, workers: 0, space: 0, space_orbital: 0 },
      effectsOnComplete: {
        production_metal: 50,
      },
      isAbundanceScaled: false,
      upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
      prerequisites: [],
    };

    state.completedCounts['metal_mine'] = 2; // 100 metal production
    state.population.workersTotal = 50000; // 100 food upkeep

    const outputs = computeNetOutputsPerTurn(state);

    // Metal production should be unaffected by food upkeep
    expect(outputs.metal).toBe(100);
    // Food should be negative (0 production - 100 upkeep)
    expect(outputs.food).toBe(-100);
    // Other resources unaffected
    expect(outputs.mineral).toBe(0);
    expect(outputs.energy).toBe(0);
  });
});

describe('Integration: Food Upkeep Not Double-Deducted', () => {
  it('should only deduct upkeep once per turn', () => {
    const state = cloneState(minimalState);

    // Remove outpost to start with clean production
    state.completedCounts = {};

    // Setup: 100 food production, 50 food upkeep, 1000 initial stocks
    getDefs()['farm'] = {
      id: 'farm',
      name: 'Farm',
      type: 'structure',
      lane: 'building',
      durationTurns: 4,
      tier: 1,
      costsPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0, workers: 0, space: 0, space_orbital: 0 },
      effectsOnComplete: {
        production_food: 100,
      },
      isAbundanceScaled: false,
      upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
      prerequisites: [],
    };

    state.completedCounts['farm'] = 1;
    state.population.workersTotal = 25000; // 50 food upkeep
    state.stocks.food = 1000;

    // Calculate net outputs (includes upkeep)
    const outputs = computeNetOutputsPerTurn(state);
    expect(outputs.food).toBe(50); // 100 production - 50 upkeep

    // Simulate adding to stocks (as done in runTurn)
    const initialFood = state.stocks.food;
    state.stocks.food += outputs.food;

    // Food should increase by net amount (no second upkeep deduction)
    expect(state.stocks.food).toBe(initialFood + 50); // 1000 + 50 = 1050
  });
});
describe('Determinism: summation order independence', () => {
  function makeFractionalState(keyOrder: string[]): PlanetState {
    const state = cloneState(minimalState);
    state.completedCounts = {};
    for (const id of keyOrder) {
      state.completedCounts[id] = 1;
    }
    return state;
  }

  it('produces bit-identical outputs regardless of completedCounts key order', () => {
    setDefsCatalog({
      frac_w: { ...getDefs().metal_mine, id: 'frac_w', name: 'W', effectsOnComplete: { production_metal: 0.1 }, upkeepPerUnit: { ...getDefs().metal_mine.upkeepPerUnit, energy: 0 } },
      frac_x: { ...getDefs().metal_mine, id: 'frac_x', name: 'X', effectsOnComplete: { production_metal: 0.2 }, upkeepPerUnit: { ...getDefs().metal_mine.upkeepPerUnit, energy: 0 } },
      frac_y: { ...getDefs().metal_mine, id: 'frac_y', name: 'Y', effectsOnComplete: { production_metal: 0.3 }, upkeepPerUnit: { ...getDefs().metal_mine.upkeepPerUnit, energy: 0 } },
      frac_z: { ...getDefs().metal_mine, id: 'frac_z', name: 'Z', effectsOnComplete: { production_metal: 0.4 }, upkeepPerUnit: { ...getDefs().metal_mine.upkeepPerUnit, energy: 0 } },
    });

    // Same entries, different insertion orders (as happens after demolish
    // deletes a zero-count key and a rebuild re-inserts it at the end).
    const stateA = makeFractionalState(['frac_w', 'frac_x', 'frac_y', 'frac_z']);
    const stateB = makeFractionalState(['frac_x', 'frac_z', 'frac_y', 'frac_w']);

    const outputsA = computeNetOutputsPerTurn(stateA);
    const outputsB = computeNetOutputsPerTurn(stateB);

    expect(outputsA.metal).toBe(outputsB.metal);
  });
});
