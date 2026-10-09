import { describe, it, expect } from 'vitest';
import {
  computePlanetScore,
  computeItemAssetScore,
  RESOURCE_SCORE_VALUES,
  POPULATION_SCORE_VALUES,
  SCORE_DIVISOR,
} from '../scoring';
import type { ItemDefinition } from '../../sim/engine/types';
import type { PlanetSummary } from '../selectors';

const baseSummary: PlanetSummary = {
  turn: 1,
  stocks: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
  abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
  outputsPerTurn: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
  space: { groundUsed: 0, groundCap: 60, orbitalUsed: 0, orbitalCap: 40 },
  housing: { workerCap: 1000, soldierCap: 1000, scientistCap: 1000 },
  population: { workersTotal: 0, workersIdle: 0, workersBusy: 0, soldiers: 0, scientists: 0 },
  ships: {},
  structures: {},
  foodUpkeep: 0,
  growthHint: '',
  planetLimit: 4,
  completedResearch: [],
};

// Minimal ItemDefinition stub for scoring tests
function makeDef(
  costs: Partial<{ metal: number; mineral: number; food: number; energy: number }>,
  durationTurns: number,
): ItemDefinition {
  return {
    id: 'test',
    name: 'Test',
    lane: 'building',
    durationTurns,
    costsPerUnit: {
      metal: costs.metal ?? 0,
      mineral: costs.mineral ?? 0,
      food: costs.food ?? 0,
      energy: costs.energy ?? 0,
      research_points: 0,
      workers: 0,
      space: 0,
      space_orbital: 0,
    },
    upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0, workers: 0, space: 0, space_orbital: 0 },
    effectsOnComplete: {},
    prerequisites: [],
    isAbundanceScaled: false,
  } as unknown as ItemDefinition;
}

// Asset scores via the in-game formula: fighter 14, battleship 288, outpost 6
const defs: Record<string, ItemDefinition> = {
  fighter:    makeDef({ metal: 6000, mineral: 2000 }, 4),
  battleship: makeDef({ metal: 24000, mineral: 16000 }, 16),
  outpost:    makeDef({ metal: 4000 }, 4),
  free_post:  makeDef({}, 4),
};

describe('computePlanetScore', () => {
  it('returns 0 for an empty planet', () => {
    expect(computePlanetScore(baseSummary, defs)).toBe(0);
  });

  it('scores population from POPULATION_SCORE_VALUES', () => {
    const summary = {
      ...baseSummary,
      population: { ...baseSummary.population, workersTotal: 1000, soldiers: 100, scientists: 10 },
    };
    expect(computePlanetScore(summary, defs)).toBe(
      (1000 / SCORE_DIVISOR) * 12 + (100 / SCORE_DIVISOR) * 128 + (10 / SCORE_DIVISOR) * 340
    );
  });

  it('scores ships with the in-game asset formula', () => {
    const summary = { ...baseSummary, ships: { fighter: 3, battleship: 1 } };
    expect(computePlanetScore(summary, defs)).toBe((3 / SCORE_DIVISOR) * 14 + (1 / SCORE_DIVISOR) * 288);
  });

  it('scores structures with the in-game asset formula', () => {
    const summary = { ...baseSummary, structures: { outpost: 2, free_post: 5 } };
    expect(computePlanetScore(summary, defs)).toBe((2 / SCORE_DIVISOR) * 6);
  });

  it('handles missing def entries without throwing', () => {
    const summary = { ...baseSummary, ships: { unknown_ship: 1 } };
    expect(() => computePlanetScore(summary, defs)).not.toThrow();
    expect(computePlanetScore(summary, defs)).toBe(0);
  });

  it('accumulates all categories together', () => {
    const summary = {
      ...baseSummary,
      stocks: { metal: 100, mineral: 100, food: 100, energy: 100, research_points: 0 },
      population: { ...baseSummary.population, workersTotal: 500, soldiers: 50, scientists: 5 },
      ships: { battleship: 2, fighter: 10 },
      structures: { outpost: 3 },
    };
    const D = SCORE_DIVISOR;
    const resourceScore = (100 / D) * 1 + (100 / D) * 1.5 + (100 / D) * 2 + (100 / D) * 2;
    const popScore = (500 / D) * 12 + (50 / D) * 128 + (5 / D) * 340;
    const assetScore = (2 / D) * 288 + (10 / D) * 14 + (3 / D) * 6;
    expect(computePlanetScore(summary, defs)).toBeCloseTo(resourceScore + popScore + assetScore, 10);
  });

  it('scores resources from stocks correctly', () => {
    const summary = {
      ...baseSummary,
      stocks: { metal: 1000, mineral: 500, food: 200, energy: 100, research_points: 0 },
    };
    const D = SCORE_DIVISOR;
    expect(computePlanetScore(summary, defs)).toBe(
      (1000 / D) * 1 + (500 / D) * 1.5 + (200 / D) * 2 + (100 / D) * 2
    );
  });

  it('ignores non-scored resources (research_points, ground_space)', () => {
    const summary = {
      ...baseSummary,
      stocks: { ...baseSummary.stocks, research_points: 999, ground_space: 50 },
    };
    expect(computePlanetScore(summary, defs)).toBe(0);
  });

  it('exports correct RESOURCE_SCORE_VALUES and SCORE_DIVISOR', () => {
    expect(RESOURCE_SCORE_VALUES.metal).toBe(1);
    expect(RESOURCE_SCORE_VALUES.mineral).toBe(1.5);
    expect(RESOURCE_SCORE_VALUES.food).toBe(2);
    expect(RESOURCE_SCORE_VALUES.energy).toBe(2);
    expect(RESOURCE_SCORE_VALUES.research_points).toBeUndefined();
    expect(SCORE_DIVISOR).toBe(1000);
  });

  it('exports correct POPULATION_SCORE_VALUES', () => {
    expect(POPULATION_SCORE_VALUES.worker).toBe(12);
    expect(POPULATION_SCORE_VALUES.soldier).toBe(128);
    expect(POPULATION_SCORE_VALUES.scientist).toBe(340);
  });
});

describe('computeItemAssetScore', () => {
  it('returns 0 for a zero-cost item', () => {
    expect(computeItemAssetScore(makeDef({}, 4))).toBe(0);
  });

  it('applies metal weight ×1', () => {
    // weightedCost = 4000×1 = 4000; round(4000×1.5/1000) = round(6) = 6; ×(4/4)=6
    expect(computeItemAssetScore(makeDef({ metal: 4000 }, 4))).toBe(6);
  });

  it('applies mineral weight ×1.5', () => {
    // weightedCost = 2000×1.5 = 3000; round(3000×1.5/1000) = round(4.5) = 5; ×(4/4)=5
    expect(computeItemAssetScore(makeDef({ mineral: 2000 }, 4))).toBe(5);
  });

  it('applies food and energy weight ×2', () => {
    // weightedCost = 1000×2 + 1000×2 = 4000; round(4000×1.5/1000) = 6; ×(8/4)=12
    expect(computeItemAssetScore(makeDef({ food: 1000, energy: 1000 }, 8))).toBe(12);
  });

  it('scales linearly with duration', () => {
    // Same costs, 8T vs 4T → score doubles
    const half = computeItemAssetScore(makeDef({ metal: 4000 }, 4));
    const full = computeItemAssetScore(makeDef({ metal: 4000 }, 8));
    expect(full).toBe(half * 2);
  });

  it('matches PHP formula for a fighter-like item (6000 metal, 2000 mineral, 4T)', () => {
    // metal=6000×1=6000, mineral=2000×1.5=3000 → weighted=9000
    // round(9000×1.5/1000)=round(13.5)=14; ×(4/4)=14
    expect(computeItemAssetScore(makeDef({ metal: 6000, mineral: 2000 }, 4))).toBe(14);
  });

  it('matches PHP formula for a slow heavy item (24000 metal, 16000 mineral, 16T)', () => {
    // metal=24000×1=24000, mineral=16000×1.5=24000 → weighted=48000
    // round(48000×1.5/1000)=round(72)=72; ×(16/4)=288
    expect(computeItemAssetScore(makeDef({ metal: 24000, mineral: 16000 }, 16))).toBe(288);
  });
});
