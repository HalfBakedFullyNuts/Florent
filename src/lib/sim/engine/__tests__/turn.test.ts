/**
 * Tests for turn runner
 * Ticket 8: Implement turn runner (deterministic sequencing)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runTurn, simulate } from '../turn';
import { CompletionBuffer } from '../buffers';
import type { PlanetState } from '../types';
import { minimalDefs, minimalState } from '../../../../test/fixtures/minimal';
import { cloneState } from '../helpers';

describe('Turn Runner', () => {
  let state: PlanetState;
  let buffer: CompletionBuffer;

  beforeEach(() => {
    state = cloneState(minimalState);
    buffer = new CompletionBuffer();
  });

  describe('runTurn', () => {
    it('should increment turn number', () => {
      const initialTurn = state.currentTurn;
      runTurn(state, buffer);
      expect(state.currentTurn).toBe(initialTurn + 1);
    });

    it('should apply resource production', () => {
      const initialMetal = state.stocks.metal;
      runTurn(state, buffer);

      // Outpost produces 300 metal (with abundance 1.0)
      expect(state.stocks.metal).toBe(initialMetal + 300);
    });

    it('should apply food upkeep', () => {
      const initialFood = state.stocks.food;
      const workers = state.population.workersTotal;
      const expectedUpkeep = workers * 0.002; // FOOD_PER_WORKER

      runTurn(state, buffer);

      // Use closeTo for floating point comparison (tolerance of 1 decimal place)
      expect(state.stocks.food).toBeCloseTo(initialFood + 100 - expectedUpkeep, 0);
    });

    it('should apply worker growth when food > 0', () => {
      const initialWorkers = state.population.workersTotal;
      state.stocks.food = 1000; // Ensure food > 0 after production and upkeep

      runTurn(state, buffer);

      // 1% base growth
      const expectedGrowth = Math.floor(initialWorkers * 0.01);
      expect(state.population.workersTotal).toBeGreaterThan(initialWorkers);
      expect(state.population.workersTotal).toBe(initialWorkers + expectedGrowth);
    });

    it('should not apply worker growth when food <= 0', () => {
      const initialWorkers = state.population.workersTotal;
      state.stocks.food = 0;

      // Also need to prevent production from adding food
      state.completedCounts = {}; // Remove outpost so no production

      runTurn(state, buffer);

      expect(state.population.workersTotal).toBe(initialWorkers);
    });

    it('should clamp worker growth to housing cap', () => {
      const initialWorkers = state.population.workersTotal;
      state.stocks.food = 1000; // Ensure food > 0 for growth

      // Set housing cap to only allow 50 more workers
      state.housing.workerCap = initialWorkers + 50;

      runTurn(state, buffer);

      // Growth would be 1% of initialWorkers (100 workers)
      // But housing only allows 50 more
      expect(state.population.workersTotal).toBe(state.housing.workerCap);
      expect(state.population.workersTotal).toBe(initialWorkers + 50);
    });

    it('should not grow workers when at housing cap', () => {
      const initialWorkers = state.population.workersTotal;
      state.stocks.food = 1000; // Ensure food > 0 for growth

      // Set housing cap equal to current workers
      state.housing.workerCap = initialWorkers;

      runTurn(state, buffer);

      // No growth should occur since we're at cap
      expect(state.population.workersTotal).toBe(initialWorkers);
    });

    it('should clamp food at 0', () => {
      state.stocks.food = 10; // Low food that will go negative after upkeep
      state.population.workersTotal = 100000; // High workers = high upkeep

      runTurn(state, buffer);

      expect(state.stocks.food).toBe(0); // Should be clamped, not negative
    });
  });

  describe('simulate', () => {
    it('should return array with initial state and N computed states', () => {
      const states = simulate(state, 5);

      expect(states).toHaveLength(6); // Initial + 5 computed
      expect(states[0]).toEqual(state); // First state is initial
    });

    it('should preserve initial state (immutability)', () => {
      const originalState = cloneState(state);
      simulate(state, 5);

      expect(state).toEqual(originalState);
    });

    it('should produce different states for each turn', () => {
      const states = simulate(state, 3);

      // Initial state starts at turn 1, not 0
      expect(states[0].currentTurn).toBe(1);
      expect(states[1].currentTurn).toBe(2);
      expect(states[2].currentTurn).toBe(3);
      expect(states[3].currentTurn).toBe(4);
    });

    it('should accumulate resources over multiple turns', () => {
      const states = simulate(state, 10);

      // Metal should increase each turn (outpost produces 300/turn)
      expect(states[1].stocks.metal).toBeGreaterThan(states[0].stocks.metal);
      expect(states[10].stocks.metal).toBeGreaterThan(states[1].stocks.metal);
    });

    it('should handle zero turns', () => {
      const states = simulate(state, 0);

      expect(states).toHaveLength(1);
      expect(states[0]).toEqual(state);
    });
  });

  describe('turn order determinism', () => {
    it('should produce identical results for same initial state', () => {
      const state1 = cloneState(minimalState);
      const state2 = cloneState(minimalState);

      const states1 = simulate(state1, 10);
      const states2 = simulate(state2, 10);

      for (let i = 0; i < states1.length; i++) {
        expect(states1[i]).toEqual(states2[i]);
      }
    });

    it('should process production before growth', () => {
      // If production happens after growth, we'd get different food values
      const state1 = cloneState(minimalState);
      state1.stocks.food = 100;

      const states = simulate(state1, 1);

      // Production should add 100 food before growth checks if food > 0
      // This test verifies order: production → growth → upkeep
      expect(states[1].population.workersTotal).toBeGreaterThan(
        states[0].population.workersTotal
      );
    });
  });

  describe('lane processing', () => {
    it('should activate pending items', () => {
      // Queue a metal mine in building lane
      state.lanes.building.pendingQueue = [{
        id: 'pending_1',
        itemId: 'metal_mine',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 4,
      }];

      runTurn(state, buffer);

      // Should be activated (moved from pending to active)
      expect(state.lanes.building.pendingQueue).toEqual([]);
      expect(state.lanes.building.active).not.toBeNull();
      expect(state.lanes.building.active?.status).toBe('active');
    });

    it('should progress active items', () => {
      // Set up active item
      state.lanes.building.active = {
        id: 'active_1',
        itemId: 'metal_mine',
        status: 'active',
        quantity: 1,
        turnsRemaining: 4,
      };

      // Reserve resources as if activation happened
      state.stocks.metal -= 1500;
      state.stocks.mineral -= 1000;
      state.population.workersIdle -= 5000;
      state.space.groundUsed += 1;

      runTurn(state, buffer);

      // Turns remaining should decrement
      expect(state.lanes.building.active?.turnsRemaining).toBe(3);
    });

    it('should complete items and enqueue for next turn', () => {
      // Set up item that will complete this turn
      state.lanes.building.active = {
        id: 'active_1',
        itemId: 'metal_mine',
        status: 'active',
        quantity: 1,
        turnsRemaining: 1,
      };

      // Reserve resources
      state.stocks.metal -= 1500;
      state.stocks.mineral -= 1000;
      state.population.workersIdle -= 5000;
      state.space.groundUsed += 1;

      const initialMetal = state.stocks.metal;
      runTurn(state, buffer);

      // Active should be cleared
      expect(state.lanes.building.active).toBeNull();

      // Structures complete same-turn, so metal should increase immediately
      // metal_mine produces 300 metal per turn
      expect(state.stocks.metal).toBeGreaterThan(initialMetal);
      expect(state.completedCounts.metal_mine).toBe(1);
    });
  });
});
