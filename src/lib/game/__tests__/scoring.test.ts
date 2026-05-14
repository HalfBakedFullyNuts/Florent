import { describe, it, expect } from 'vitest';
import { computePlanetScore } from '../scoring';
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
  worker:      { scoreValue: 1 },
  soldier:     { scoreValue: 104 },
  scientist:   { scoreValue: 208 },
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
    expect(computePlanetScore(summary, defs)).toBe(1000 * 1);
  });

  it('scores soldiers and scientists correctly', () => {
    const summary = {
      ...baseSummary,
      population: { ...baseSummary.population, soldiers: 100, scientists: 10 },
    };
    expect(computePlanetScore(summary, defs)).toBe(100 * 104 + 10 * 208);
  });

  it('scores ships correctly', () => {
    const summary = { ...baseSummary, ships: { fighter: 3, destroyer: 1 } };
    expect(computePlanetScore(summary, defs)).toBe(3 * 5 + 1 * 100);
  });

  it('scores structures that have scoreValue', () => {
    const defsWithScore = { ...defs, outpost: { scoreValue: 50 } };
    const summary = { ...baseSummary, structures: { outpost: 2 } };
    expect(computePlanetScore(summary, defsWithScore)).toBe(2 * 50);
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
      population: { ...baseSummary.population, workersTotal: 500, soldiers: 50, scientists: 5 },
      ships: { battleship: 2, fighter: 10 },
      structures: { metal_mine: 3 },
    };
    const expected = 500 * 1 + 50 * 104 + 5 * 208 + 2 * 800 + 10 * 5 + 0;
    expect(computePlanetScore(summary, defs)).toBe(expected);
  });

  it('score updates reflect a ship completion (before vs after)', () => {
    const before = { ...baseSummary, ships: {} };
    const after  = { ...baseSummary, ships: { destroyer: 1 } };
    expect(computePlanetScore(after, defs) - computePlanetScore(before, defs)).toBe(100);
  });
});
