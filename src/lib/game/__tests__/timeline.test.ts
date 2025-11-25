/**
 * Tests for Timeline management - Fixed 200-turn architecture
 * TICKET-3: Refactored for fixed 200-turn pre-computed timeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Timeline } from '../state';
import { GameController } from '../commands';
import type { PlanetState } from '../../sim/engine/types';
import { minimalState } from '../../../test/fixtures/minimal';
import { cloneState } from '../../sim/engine/helpers';

describe('Timeline - Fixed 200-Turn Architecture', () => {
  let timeline: Timeline;
  let initialState: PlanetState;

  beforeEach(() => {
    initialState = cloneState(minimalState);
    timeline = new Timeline(initialState);
  });

  describe('initialization', () => {
    it('should store initial state at turn 1', () => {
      const state = timeline.getStateAtTurn(1);
      expect(state).toBeDefined();
      expect(state?.currentTurn).toBe(1);
    });

    it('should start at turn 1', () => {
      expect(timeline.getCurrentTurn()).toBe(1);
    });

    it('should always have exactly 200 pre-computed turns', () => {
      expect(timeline.getTotalTurns()).toBe(200);
    });

    it('should pre-compute all 200 turns immediately', () => {
      // All turns should be accessible
      const turn100 = timeline.getStateAtTurn(100);
      const turn200 = timeline.getStateAtTurn(200);

      expect(turn100).toBeDefined();
      expect(turn200).toBeDefined();
      expect(turn100?.currentTurn).toBe(100);
      expect(turn200?.currentTurn).toBe(200);
    });
  });

  describe('time travel', () => {
    it('should allow setting current turn within bounds (1-200)', () => {
      const success = timeline.setCurrentTurn(50);
      expect(success).toBe(true);
      expect(timeline.getCurrentTurn()).toBe(50);
    });

    it('should reject setting turn beyond 200', () => {
      const currentBefore = timeline.getCurrentTurn();
      const success = timeline.setCurrentTurn(201);

      expect(success).toBe(false);
      expect(timeline.getCurrentTurn()).toBe(currentBefore); // Should remain unchanged
    });

    it('should reject negative turns', () => {
      const success = timeline.setCurrentTurn(-1);
      expect(success).toBe(false);
    });

    it('should reject turn 0', () => {
      const success = timeline.setCurrentTurn(0);
      expect(success).toBe(false);
    });

    it('should get state at any turn (1-200)', () => {
      const state50 = timeline.getStateAtTurn(50);
      const state150 = timeline.getStateAtTurn(150);

      expect(state50).toBeDefined();
      expect(state150).toBeDefined();
      expect(state50?.currentTurn).toBe(50);
      expect(state150?.currentTurn).toBe(150);
    });

    it('should return undefined for turns beyond 200', () => {
      const state = timeline.getStateAtTurn(201);
      expect(state).toBeUndefined();
    });
  });

  describe('next turn', () => {
    it('should advance to next turn', () => {
      const state = timeline.nextTurn();

      expect(timeline.getCurrentTurn()).toBe(2);
      expect(state.currentTurn).toBe(2);
    });

    it('should not exceed turn 200', () => {
      timeline.setCurrentTurn(200);
      timeline.nextTurn();

      expect(timeline.getCurrentTurn()).toBe(200); // Should stay at 200
    });

    it('should always maintain 200 total turns', () => {
      timeline.nextTurn();
      timeline.nextTurn();

      expect(timeline.getTotalTurns()).toBe(200); // Never changes
    });
  });

  describe('simulate turns (backward compatibility)', () => {
    it('should not change total turns (always 200)', () => {
      timeline.simulateTurns(50);
      expect(timeline.getTotalTurns()).toBe(200);
    });

    it('should advance view by N turns', () => {
      const currentBefore = timeline.getCurrentTurn();
      timeline.simulateTurns(10);

      expect(timeline.getCurrentTurn()).toBe(currentBefore + 10);
    });

    it('should not exceed turn 200', () => {
      timeline.setCurrentTurn(195);
      timeline.simulateTurns(10); // Try to go to 205

      expect(timeline.getCurrentTurn()).toBe(200); // Capped at 200
    });
  });

  describe('mutate at turn', () => {
    it('should apply mutation to specified turn', () => {
      const success = timeline.mutateAtTurn(50, (state) => {
        state.stocks.metal += 1000;
      });

      expect(success).toBe(true);

      const state = timeline.getStateAtTurn(50);
      expect(state?.stocks.metal).toBeGreaterThan(initialState.stocks.metal);
    });

    it('should trigger full recomputation (all 200 turns)', () => {
      timeline.mutateAtTurn(50, (state) => {
        state.stocks.metal += 1000;
      });

      // All turns after mutation should reflect the change
      expect(timeline.getTotalTurns()).toBe(200); // Still 200 turns

      const state100 = timeline.getStateAtTurn(100);
      expect(state100?.stocks.metal).toBeGreaterThan(initialState.stocks.metal);
    });

    it('should reject mutation beyond turn 200', () => {
      const success = timeline.mutateAtTurn(201, (state) => {
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

    it('should reject turn 0', () => {
      const success = timeline.mutateAtTurn(0, (state) => {
        state.stocks.metal += 1000;
      });

      expect(success).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to new initial state', () => {
      const newState = cloneState(initialState);
      newState.stocks.metal = 99999;

      timeline.reset(newState);

      const state = timeline.getCurrentState();
      expect(state.stocks.metal).toBe(99999);
    });

    it('should reset to turn 1', () => {
      timeline.setCurrentTurn(50);
      timeline.reset(initialState);

      expect(timeline.getCurrentTurn()).toBe(1);
    });

    it('should maintain exactly 200 turns after reset', () => {
      timeline.reset(initialState);
      expect(timeline.getTotalTurns()).toBe(200);
    });

    it('should recompute all 200 turns after reset', () => {
      const newState = cloneState(initialState);
      newState.stocks.metal = 99999;

      timeline.reset(newState);

      // All turns should reflect new initial state
      const turn100 = timeline.getStateAtTurn(100);
      expect(turn100).toBeDefined();
      expect(turn100?.stocks.metal).toBeGreaterThan(initialState.stocks.metal);
    });
  });

  describe('get all states', () => {
    it('should return all 200 states', () => {
      const states = timeline.getAllStates();
      expect(states).toHaveLength(200);
    });

    it('should return clones (mutations do not affect timeline)', () => {
      const states = timeline.getAllStates();

      // Mutate returned state
      states[50].stocks.metal = 999999;

      // Original should be unchanged
      const originalState = timeline.getStateAtTurn(51); // states[50] is turn 51 (1-indexed)
      expect(originalState?.stocks.metal).not.toBe(999999);
    });
  });

  describe('stable state optimization', () => {
    it('should detect stable state when all lanes are idle', () => {
      // Timeline should eventually reach stable state (no work remaining)
      // Check that later turns are identical (optimization working)
      const turn180 = timeline.getStateAtTurn(180);
      const turn190 = timeline.getStateAtTurn(190);
      const turn200 = timeline.getStateAtTurn(200);

      // If optimization worked, these should be identical except for turn number
      expect(turn180?.lanes.building.active).toBeNull();
      expect(turn190?.lanes.building.active).toBeNull();
      expect(turn200?.lanes.building.active).toBeNull();

      expect(turn180?.lanes.building.pendingQueue).toEqual([]);
      expect(turn190?.lanes.building.pendingQueue).toEqual([]);
      expect(turn200?.lanes.building.pendingQueue).toEqual([]);
    });
  });
});

describe('GameController - Fixed 200-Turn Architecture', () => {
  let controller: GameController;
  let initialState: PlanetState;

  beforeEach(() => {
    initialState = cloneState(minimalState);
    controller = new GameController(initialState);
  });

  describe('queue item', () => {
    it('should queue valid item when energy available', () => {
      const stateWithEnergy = cloneState(initialState);
      stateWithEnergy.stocks.energy = 100;
      const ctrl = new GameController(stateWithEnergy);

      const result = ctrl.queueItem(1, 'metal_mine', 1); // Turn 1, not 0

      expect(result.success).toBe(true);
      expect(result.itemId).toBeDefined();
    });

    it('should reject item with missing prerequisites', () => {
      const result = controller.queueItem(1, 'soldier', 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('REQ_MISSING');
    });

    it('should allow queueing multiple items when lane is idle', () => {
      const stateWithEnergy = cloneState(initialState);
      stateWithEnergy.stocks.energy = 100;
      const ctrl = new GameController(stateWithEnergy);

      const result1 = ctrl.queueItem(1, 'metal_mine', 1);
      expect(result1.success).toBe(true);

      const result2 = ctrl.queueItem(1, 'farm', 1);
      expect(result2.success).toBe(true);
    });
  });

  describe('cancel entry', () => {
    it('should cancel pending item', () => {
      const stateWithEnergy = cloneState(initialState);
      stateWithEnergy.stocks.energy = 100;
      const ctrl = new GameController(stateWithEnergy);

      ctrl.queueItem(1, 'metal_mine', 1);
      const result = ctrl.cancelEntry(1, 'building');

      expect(result.success).toBe(true);

      const finalState = ctrl.getStateAtTurn(1);
      expect(finalState?.lanes.building.pendingQueue).toEqual([]);
    });

    it('should return false when no item to cancel', () => {
      const result = controller.cancelEntry(1, 'building');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });
  });

  describe('turn management', () => {
    it('should advance to next turn', () => {
      const state = controller.nextTurn();

      expect(state.currentTurn).toBe(2);
      expect(controller.getCurrentTurn()).toBe(2);
    });

    it('should always have 200 total turns (simulateTurns is no-op)', () => {
      controller.simulateTurns(50);
      expect(controller.getTotalTurns()).toBe(200);
    });

    it('should allow time travel within 1-200 range', () => {
      const success = controller.setTurn(100);

      expect(success).toBe(true);
      expect(controller.getCurrentTurn()).toBe(100);
    });
  });

  describe('scenario loading', () => {
    it('should load new scenario and reset to turn 1', () => {
      const newState = cloneState(initialState);
      newState.stocks.metal = 99999;

      controller.loadScenario(newState);

      const state = controller.getCurrentState();
      expect(state.stocks.metal).toBe(99999);
      expect(controller.getCurrentTurn()).toBe(1); // Resets to turn 1
    });

    it('should maintain 200 turns after scenario load', () => {
      controller.loadScenario(initialState);
      expect(controller.getTotalTurns()).toBe(200);
    });
  });
});
