import { describe, it, expect } from 'vitest';
import { computePlanetScore, RESOURCE_SCORE_VALUES, SCORE_DIVISOR } from '../scoring';
import type { PlanetSummary } from '../selectors';

const baseSummary: PlanetSummary = {
  turn: 1,
  stocks: { metal: 0, mineral: 0, food: 0, energy: 0 },
  abundance: { metal: 1, mineral: 1, food: 1, energy: 1 },
  outputsPerTurn: { metal: 0, mineral: 0, food: 0, energy: 0 },
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

const defs: Record<string, { scoreValue?: number }> = {
  worker:      { scoreValue: 12 },
  soldier:     { scoreValue: 128 },
  scientist:   { scoreValue: 340 },
  fighter:     { scoreValue: 5 },
  destroyer:   { scoreValue: 100 },
  battleship:  { scoreValue: 800 },
  metal_mine:  {},                    // no scoreValue — should contribute 0
};

describe('computePlanetScore', () => {
  it('returns 0 for an empty planet', () => {
    expect(computePlanetScore(baseSummary, defs)).toBe(0);
  });

  it('scores workers correctly', () => {
    const summary = { ...baseSummary, population: { ...baseSummary.population, workersTotal: 1000 } };
    expect(computePlanetScore(summary, defs)).toBe((1000 / SCORE_DIVISOR) * 12);
  });

  it('scores soldiers and scientists correctly', () => {
    const summary = {
      ...baseSummary,
      population: { ...baseSummary.population, soldiers: 100, scientists: 10 },
    };
    expect(computePlanetScore(summary, defs)).toBe((100 / SCORE_DIVISOR) * 128 + (10 / SCORE_DIVISOR) * 340);
  });

  it('scores ships correctly', () => {
    const summary = { ...baseSummary, ships: { fighter: 3, destroyer: 1 } };
    expect(computePlanetScore(summary, defs)).toBe((3 / SCORE_DIVISOR) * 5 + (1 / SCORE_DIVISOR) * 100);
  });

  it('scores structures that have scoreValue', () => {
    const defsWithScore = { ...defs, outpost: { scoreValue: 50 } };
    const summary = { ...baseSummary, structures: { outpost: 2 } };
    expect(computePlanetScore(summary, defsWithScore)).toBe((2 / SCORE_DIVISOR) * 50);
  });

  it('ignores structures without scoreValue (treats as 0)', () => {
    const summary = { ...baseSummary, structures: { metal_mine: 5 } };
    expect(computePlanetScore(summary, defs)).toBe(0);
  });

  it('handles missing def entries without throwing', () => {
    const summary = { ...baseSummary, ships: { unknown_ship: 1 } };
    expect(() => computePlanetScore(summary, defs)).not.toThrow();
    expect(computePlanetScore(summary, defs)).toBe(0);
  });

  it('accumulates all categories together', () => {
    const summary = {
      ...baseSummary,
      stocks: { metal: 100, mineral: 100, food: 100, energy: 100 },
      population: { ...baseSummary.population, workersTotal: 500, soldiers: 50, scientists: 5 },
      ships: { battleship: 2, fighter: 10 },
      structures: { metal_mine: 3 },
    };
    const D = SCORE_DIVISOR;
    const resourceScore = (100 / D) * 1 + (100 / D) * 1.5 + (100 / D) * 2 + (100 / D) * 2;
    const popScore = (500 / D) * 12 + (50 / D) * 128 + (5 / D) * 340;
    const shipScore = (2 / D) * 800 + (10 / D) * 5;
    const expected = resourceScore + popScore + shipScore;
    expect(computePlanetScore(summary, defs)).toBeCloseTo(expected, 10);
  });

  it('score updates reflect a ship completion (before vs after)', () => {
    const before = { ...baseSummary, ships: {} };
    const after  = { ...baseSummary, ships: { destroyer: 1 } };
    expect(computePlanetScore(after, defs) - computePlanetScore(before, defs)).toBe((1 / SCORE_DIVISOR) * 100);
  });

  it('scores resources from stocks correctly', () => {
    const summary = {
      ...baseSummary,
      stocks: { metal: 1000, mineral: 500, food: 200, energy: 100 },
    };
    const D = SCORE_DIVISOR;
    // (1000/D)*1 + (500/D)*1.5 + (200/D)*2 + (100/D)*2 = 1 + 0.75 + 0.4 + 0.2 = 2.35
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
});
