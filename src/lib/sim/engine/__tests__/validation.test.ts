/**
 * Tests for validation primitives
 * Ticket 3: Build validation primitives
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasPrereqs,
  housingExistsForColonist,
  energyNonNegativeAfterCompletion,
  canQueue,
  clampBatchAtActivation,
} from '../validation';
import type { PlanetState, ItemDefinition } from '../types';
import { minimalDefs } from '../../../../test/fixtures/minimal';

describe('Validation Primitives', () => {
  let state: PlanetState;
  let metalMineDef: ItemDefinition;
  let soldierDef: ItemDefinition;

  beforeEach(() => {
    // Create minimal test state
    state = {
      currentTurn: 0,
      stocks: {
        metal: 5000,
        mineral: 3000,
        food: 500,
        energy: 100,
      },
      abundance: {
        metal: 1.0,
        mineral: 1.0,
        food: 1.0,
        energy: 1.0,
      },
      population: {
        workersTotal: 10000,
        workersIdle: 8000,
        soldiers: 0,
        scientists: 0,
        busyByLane: {
          building: 0,
          ship: 0,
          colonist: 0,
        },
      },
      space: {
        groundUsed: 1,
        groundCap: 60,
        orbitalUsed: 0,
        orbitalCap: 40,
      },
      housing: {
        workerCap: 50000,
        soldierCap: 100000,
        scientistCap: 0,
      },
      lanes: {
        building: { pendingQueue: [], active: null, maxQueueDepth: 10 },
        ship: { pendingQueue: [], active: null, maxQueueDepth: 10 },
        colonist: { pendingQueue: [], active: null, maxQueueDepth: 10 },
      },
      completedCounts: {
        outpost: 1,
      },
      pendingColonistConversions: [],
      defs: minimalDefs,
    };

    metalMineDef = minimalDefs.metal_mine;
    soldierDef = minimalDefs.soldier;
  });

  describe('hasPrereqs', () => {
    it('should return true when no prerequisites', () => {
      const outpostDef = minimalDefs.outpost;
      expect(hasPrereqs(state, outpostDef)).toBe(true);
    });

    it('should return true when prerequisites are met', () => {
      expect(hasPrereqs(state, metalMineDef)).toBe(true);
    });

    it('should return false when prerequisites are missing', () => {
      const defWithMissingPrereq: ItemDefinition = {
        ...metalMineDef,
        prerequisites: ['nonexistent_structure'],
      };
      expect(hasPrereqs(state, defWithMissingPrereq)).toBe(false);
    });

    it('should return false when prerequisite count is zero', () => {
      state.completedCounts.outpost = 0;
      expect(hasPrereqs(state, metalMineDef)).toBe(false);
    });
  });

  describe('housingExistsForColonist', () => {
    it('should return true for non-colonist items', () => {
      expect(housingExistsForColonist(state, metalMineDef, 1)).toBe(true);
    });

    it('should return true when soldier housing is available', () => {
      expect(housingExistsForColonist(state, soldierDef, 10)).toBe(true);
    });

    it('should return false when soldier housing is full', () => {
      state.population.soldiers = 100000;
      expect(housingExistsForColonist(state, soldierDef, 1)).toBe(false);
    });

    it('should return false when requesting more soldiers than housing', () => {
      state.population.soldiers = 99995;
      expect(housingExistsForColonist(state, soldierDef, 10)).toBe(false);
    });
  });

  describe('energyNonNegativeAfterCompletion', () => {
    it('should return true when no energy upkeep', () => {
      const noUpkeepDef: ItemDefinition = {
        ...metalMineDef,
        upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0 },
      };
      expect(energyNonNegativeAfterCompletion(state, noUpkeepDef, 10)).toBe(true);
    });

    it('should return true when energy output can sustain upkeep', () => {
      // Add solar generator (+100 energy/turn) and metal mine (-10 energy/turn)
      // Net: +90 energy/turn, can sustain another -10
      state.completedCounts.solar_generator = 1;
      state.completedCounts.metal_mine = 1;
      expect(energyNonNegativeAfterCompletion(state, metalMineDef, 1)).toBe(true);
    });

    it('should return false when energy output cannot sustain upkeep', () => {
      // Add solar generator (+100) and 10 metal mines (-100)
      // Net: 0 energy/turn, cannot sustain another -10
      state.completedCounts.solar_generator = 1;
      state.completedCounts.metal_mine = 10;
      expect(energyNonNegativeAfterCompletion(state, metalMineDef, 1)).toBe(false);
    });

    it('should account for quantity in upkeep calculation', () => {
      // Solar generator: +100, metal mine: -10 each
      // Net: +100 -10 = +90 energy/turn
      state.completedCounts.solar_generator = 1;
      state.completedCounts.metal_mine = 1;
      expect(energyNonNegativeAfterCompletion(state, metalMineDef, 8)).toBe(true); // +90 - 80 = +10
      expect(energyNonNegativeAfterCompletion(state, metalMineDef, 9)).toBe(true); // +90 - 90 = 0 (allowed)
      expect(energyNonNegativeAfterCompletion(state, metalMineDef, 10)).toBe(false); // +90 - 100 = -10 (not allowed)
    });
  });

  describe('canQueue', () => {
    it('should allow queuing when all conditions met', () => {
      const result = canQueue(state, metalMineDef, 1);
      expect(result.allowed).toBe(true);
    });

    it('should reject when prerequisites missing', () => {
      state.completedCounts.outpost = 0;
      const result = canQueue(state, metalMineDef, 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('REQ_MISSING');
    });

    it('should reject when housing missing for colonists', () => {
      state.completedCounts.barracks = 1; // Meet prerequisites first
      state.housing.soldierCap = 0;
      const result = canQueue(state, soldierDef, 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('HOUSING_MISSING');
    });

    it('should reject when energy output will be insufficient', () => {
      // Set up negative energy balance: +100 from solar, -100 from 10 mines
      state.completedCounts.solar_generator = 1;
      state.completedCounts.metal_mine = 10;
      // Net = 0, cannot add another -10
      const result = canQueue(state, metalMineDef, 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENERGY_INSUFFICIENT');
    });
  });

  describe('clampBatchAtActivation', () => {
    it('should return requested quantity when all resources available', () => {
      const clamped = clampBatchAtActivation(state, metalMineDef, 1);
      expect(clamped).toBe(1);
    });

    it('should clamp by metal availability', () => {
      state.stocks.metal = 2000; // Can afford 1 metal mine (costs 1500)
      const clamped = clampBatchAtActivation(state, metalMineDef, 5);
      expect(clamped).toBe(1);
    });

    it('should clamp by mineral availability', () => {
      state.stocks.mineral = 1500; // Can afford 1 metal mine (costs 1000)
      const clamped = clampBatchAtActivation(state, metalMineDef, 5);
      expect(clamped).toBe(1);
    });

    it('should clamp by worker availability', () => {
      state.population.workersIdle = 7000; // Can afford 1 metal mine (needs 5000)
      const clamped = clampBatchAtActivation(state, metalMineDef, 5);
      expect(clamped).toBe(1);
    });

    it('should clamp by space availability', () => {
      state.space.groundUsed = 59; // Only 1 space left
      const clamped = clampBatchAtActivation(state, metalMineDef, 5);
      expect(clamped).toBe(1);
    });

    it('should return 0 when no resources available', () => {
      state.stocks.metal = 0;
      const clamped = clampBatchAtActivation(state, metalMineDef, 1);
      expect(clamped).toBe(0);
    });

    it('should handle multiple constraints correctly', () => {
      state.stocks.metal = 3500; // Can afford 2
      state.stocks.mineral = 2500; // Can afford 2
      state.population.workersIdle = 12000; // Can afford 2
      state.space.groundUsed = 58; // Only 2 spaces left
      const clamped = clampBatchAtActivation(state, metalMineDef, 10);
      expect(clamped).toBe(2);
    });
  });
});
