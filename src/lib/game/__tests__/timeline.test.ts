/**
 * Tests for Timeline management
 * Ticket 9: Timeline & recomputation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Timeline } from '../state';
import { GameController } from '../commands';
import type { PlanetState } from '../../sim/engine/types';
import { minimalState } from '../../../test/fixtures/minimal';
import { cloneState } from '../../sim/engine/helpers';

describe('Timeline', () => {
  let timeline: Timeline;
  let initialState: PlanetState;

  beforeEach(() => {
    initialState = cloneState(minimalState);
    timeline = new Timeline(initialState);
  });

  describe('initialization', () => {
    it('should store initial state', () => {
      const state = timeline.getStateAtTurn(0);
      expect(state).toBeDefined();
      expect(state?.currentTurn).toBe(0);
    });

    it('should start at turn 0', () => {
      expect(timeline.getCurrentTurn()).toBe(0);
    });

    it('should have 1 computed state initially', () => {
      expect(timeline.getTotalTurns()).toBe(1);
    });
  });

  describe('time travel', () => {
    beforeEach(() => {
      // Simulate ahead to create history
      timeline.simulateTurns(5);
    });

    it('should allow setting current turn within bounds', () => {
      const success = timeline.setCurrentTurn(3);
      expect(success).toBe(true);
      expect(timeline.getCurrentTurn()).toBe(3);
    });

    it('should reject setting turn out of bounds', () => {
      const success = timeline.setCurrentTurn(10);
      expect(success).toBe(false);
      expect(timeline.getCurrentTurn()).toBe(0); // Should remain unchanged
    });

    it('should reject negative turns', () => {
      const success = timeline.setCurrentTurn(-1);
      expect(success).toBe(false);
    });

    it('should get state at any computed turn', () => {
      const state = timeline.getStateAtTurn(3);
      expect(state).toBeDefined();
      expect(state?.currentTurn).toBe(3);
    });

    it('should return undefined for uncomputed turns', () => {
      const state = timeline.getStateAtTurn(10);
      expect(state).toBeUndefined();
    });
  });

  describe('next turn', () => {
    it('should compute new turn when at end of timeline', () => {
      const initialTotal = timeline.getTotalTurns();
      timeline.nextTurn();

      expect(timeline.getCurrentTurn()).toBe(1);
      expect(timeline.getTotalTurns()).toBe(initialTotal + 1);
    });

    it('should advance index when not at end', () => {
      timeline.simulateTurns(5);
      timeline.setCurrentTurn(0);

      const totalBefore = timeline.getTotalTurns();
      timeline.nextTurn();

      expect(timeline.getCurrentTurn()).toBe(1);
      expect(timeline.getTotalTurns()).toBe(totalBefore); // No new computation
    });

    it('should return current state after advancing', () => {
      const state = timeline.nextTurn();
      expect(state.currentTurn).toBe(1);
    });
  });

  describe('simulate turns', () => {
    it('should extend timeline by N turns', () => {
      const initialTotal = timeline.getTotalTurns();
      timeline.simulateTurns(5);

      expect(timeline.getTotalTurns()).toBe(initialTotal + 5);
    });

    it('should not change current turn index', () => {
      const currentBefore = timeline.getCurrentTurn();
      timeline.simulateTurns(5);

      expect(timeline.getCurrentTurn()).toBe(currentBefore);
    });

    it('should handle zero turns', () => {
      const totalBefore = timeline.getTotalTurns();
      timeline.simulateTurns(0);

      expect(timeline.getTotalTurns()).toBe(totalBefore);
    });

    it('should compute each turn sequentially', () => {
      timeline.simulateTurns(3);

      const state1 = timeline.getStateAtTurn(1);
      const state2 = timeline.getStateAtTurn(2);
      const state3 = timeline.getStateAtTurn(3);

      expect(state1?.currentTurn).toBe(1);
      expect(state2?.currentTurn).toBe(2);
      expect(state3?.currentTurn).toBe(3);
    });
  });

  describe('recompute from turn', () => {
    beforeEach(() => {
      timeline.simulateTurns(10);
    });

    it('should truncate timeline at specified turn', () => {
      timeline.recomputeFromTurn(5);

      expect(timeline.getTotalTurns()).toBe(6); // Turns 0-5
    });

    it('should reset current turn if beyond truncation point', () => {
      timeline.setCurrentTurn(8);
      timeline.recomputeFromTurn(5);

      expect(timeline.getCurrentTurn()).toBe(5);
    });

    it('should preserve current turn if before truncation point', () => {
      timeline.setCurrentTurn(3);
      timeline.recomputeFromTurn(5);

      expect(timeline.getCurrentTurn()).toBe(3);
    });

    it('should make future turns uncomputed', () => {
      timeline.recomputeFromTurn(5);

      const state6 = timeline.getStateAtTurn(6);
      expect(state6).toBeUndefined();
    });

    it('should handle edge case of truncating at turn 0', () => {
      timeline.recomputeFromTurn(0);

      expect(timeline.getTotalTurns()).toBe(1);
      expect(timeline.getCurrentTurn()).toBe(0);
    });
  });

  describe('mutate at turn', () => {
    beforeEach(() => {
      timeline.simulateTurns(10);
    });

    it('should apply mutation to specified turn', () => {
      const success = timeline.mutateAtTurn(5, (state) => {
        state.stocks.metal += 1000;
      });

      expect(success).toBe(true);

      const state = timeline.getStateAtTurn(5);
      expect(state?.stocks.metal).toBeGreaterThan(initialState.stocks.metal);
    });

    it('should trigger recomputation after mutation', () => {
      const totalBefore = timeline.getTotalTurns();
      timeline.mutateAtTurn(5, (state) => {
        state.stocks.metal += 1000;
      });

      // Should truncate at turn 5, so total turns becomes 6 (0-5)
      expect(timeline.getTotalTurns()).toBe(6);
    });

    it('should reject mutation at invalid turn', () => {
      const success = timeline.mutateAtTurn(20, (state) => {
        state.stocks.metal += 1000;
      });

      expect(success).toBe(false);
    });

    it('should reject negative turn numbers', () => {
      const success = timeline.mutateAtTurn(-1, (state) => {
        state.stocks.metal += 1000;
      });

      expect(success).toBe(false);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      timeline.simulateTurns(10);
      timeline.setCurrentTurn(5);
    });

    it('should reset to new initial state', () => {
      const newState = cloneState(initialState);
      newState.stocks.metal = 99999;

      timeline.reset(newState);

      const state = timeline.getCurrentState();
      expect(state.stocks.metal).toBe(99999);
    });

    it('should reset to turn 0', () => {
      timeline.reset(initialState);
      expect(timeline.getCurrentTurn()).toBe(0);
    });

    it('should clear all history', () => {
      timeline.reset(initialState);
      expect(timeline.getTotalTurns()).toBe(1);
    });
  });

  describe('get all states', () => {
    it('should return clones of all states', () => {
      timeline.simulateTurns(5);
      const states = timeline.getAllStates();

      expect(states).toHaveLength(6); // 0-5

      // Mutating returned state should not affect timeline
      states[3].stocks.metal = 999999;
      const originalState = timeline.getStateAtTurn(3);
      expect(originalState?.stocks.metal).not.toBe(999999);
    });
  });
});

describe('GameController', () => {
  let controller: GameController;
  let initialState: PlanetState;

  beforeEach(() => {
    initialState = cloneState(minimalState);
    controller = new GameController(initialState);
  });

  describe('queue item', () => {
    it('should queue valid item when energy available', () => {
      // Create a new controller with energy
      const stateWithEnergy = cloneState(initialState);
      stateWithEnergy.stocks.energy = 100;
      const ctrl = new GameController(stateWithEnergy);

      const result = ctrl.queueItem(0, 'metal_mine', 1);

      expect(result.success).toBe(true);
      expect(result.itemId).toBeDefined();
    });

    it('should reject item with missing prerequisites', () => {
      // Soldier requires barracks
      const result = controller.queueItem(0, 'soldier', 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('REQ_MISSING');
    });

    it('should reject item when lane is busy', () => {
      // Create controller with energy
      const stateWithEnergy = cloneState(initialState);
      stateWithEnergy.stocks.energy = 100;
      const ctrl = new GameController(stateWithEnergy);

      // Queue first item
      ctrl.queueItem(0, 'metal_mine', 1);

      // Try to queue second item in same lane
      const result = ctrl.queueItem(0, 'farm', 1);

      expect(result.success).toBe(false);
    });
  });

  describe('cancel entry', () => {
    it('should cancel pending item', () => {
      // Create controller with energy
      const stateWithEnergy = cloneState(initialState);
      stateWithEnergy.stocks.energy = 100;
      const ctrl = new GameController(stateWithEnergy);

      // Queue an item
      ctrl.queueItem(0, 'metal_mine', 1);

      // Cancel it
      const result = ctrl.cancelEntry(0, 'building');

      expect(result.success).toBe(true);

      // Lane should be clear
      const finalState = ctrl.getStateAtTurn(0);
      expect(finalState?.lanes.building.pending).toBeNull();
    });

    it('should return false when no item to cancel', () => {
      const result = controller.cancelEntry(0, 'building');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });
  });

  describe('turn management', () => {
    it('should advance to next turn', () => {
      const state = controller.nextTurn();

      expect(state.currentTurn).toBe(1);
      expect(controller.getCurrentTurn()).toBe(1);
    });

    it('should simulate multiple turns ahead', () => {
      controller.simulateTurns(5);

      expect(controller.getTotalTurns()).toBe(6); // 0-5
    });

    it('should allow time travel', () => {
      controller.simulateTurns(5);
      const success = controller.setTurn(3);

      expect(success).toBe(true);
      expect(controller.getCurrentTurn()).toBe(3);
    });
  });

  describe('scenario loading', () => {
    it('should load new scenario', () => {
      const newState = cloneState(initialState);
      newState.stocks.metal = 99999;

      controller.loadScenario(newState);

      const state = controller.getCurrentState();
      expect(state.stocks.metal).toBe(99999);
      expect(controller.getCurrentTurn()).toBe(0);
    });
  });
});
