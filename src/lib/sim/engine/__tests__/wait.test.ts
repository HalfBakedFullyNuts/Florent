/**
 * Tests for wait item functionality
 * Wait items allow pausing lane activity for N turns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { PlanetState, WorkItem, LaneId } from '../types';
import { tryActivateNext, progressActive } from '../lanes';
import { minimalDefs } from '../../../../test/fixtures/minimal';
import { createMinimalStart } from '../../defs/seed';

describe('Wait Item Functionality', () => {
  let state: PlanetState;

  beforeEach(() => {
    state = createMinimalStart(minimalDefs);
  });

  describe('Wait Item Creation', () => {
    it('should create a wait item with specified duration', () => {
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 5,
        isWait: true,
      };

      expect(waitItem.isWait).toBe(true);
      expect(waitItem.turnsRemaining).toBe(5);
      expect(waitItem.itemId).toBe('__wait__');
    });
  });

  describe('Wait Item in Queue', () => {
    it('should allow queueing a wait item without validation checks', () => {
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 3,
        isWait: true,
      };

      state.lanes.building.pendingQueue.push(waitItem);

      expect(state.lanes.building.pendingQueue).toHaveLength(1);
      expect(state.lanes.building.pendingQueue[0].isWait).toBe(true);
    });

    it('should queue wait items in any lane', () => {
      const lanes: LaneId[] = ['building', 'ship', 'colonist', 'research'];

      lanes.forEach((laneId, index) => {
        const waitItem: WorkItem = {
          id: `wait-${index}`,
          itemId: '__wait__',
          status: 'pending',
          quantity: 1,
          turnsRemaining: 2,
          isWait: true,
        };

        state.lanes[laneId].pendingQueue.push(waitItem);
        expect(state.lanes[laneId].pendingQueue[0].isWait).toBe(true);
      });
    });
  });

  describe('Wait Item Activation', () => {
    it('should activate wait item without deducting resources', () => {
      const initialMetal = state.stocks.metal;
      const initialMineral = state.stocks.mineral;
      const initialFood = state.stocks.food;
      const initialEnergy = state.stocks.energy;
      const initialWorkers = state.population.workersIdle;

      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 3,
        isWait: true,
      };

      state.lanes.building.pendingQueue.push(waitItem);
      tryActivateNext(state, 'building');

      // Resources should not be deducted
      expect(state.stocks.metal).toBe(initialMetal);
      expect(state.stocks.mineral).toBe(initialMineral);
      expect(state.stocks.food).toBe(initialFood);
      expect(state.stocks.energy).toBe(initialEnergy);
      expect(state.population.workersIdle).toBe(initialWorkers);

      // Wait item should be active
      expect(state.lanes.building.active).toBeDefined();
      expect(state.lanes.building.active?.isWait).toBe(true);
      expect(state.lanes.building.active?.turnsRemaining).toBe(3);
    });

    it('should activate wait item even with zero resources', () => {
      // Drain all resources
      state.stocks.metal = 0;
      state.stocks.mineral = 0;
      state.stocks.food = 0;
      state.stocks.energy = 0;
      state.population.workersIdle = 0;

      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 2,
        isWait: true,
      };

      state.lanes.building.pendingQueue.push(waitItem);
      tryActivateNext(state, 'building');

      // Wait item should still activate
      expect(state.lanes.building.active).toBeDefined();
      expect(state.lanes.building.active?.isWait).toBe(true);
    });
  });

  describe('Wait Item Progression', () => {
    it('should decrement turnsRemaining each turn', () => {
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'active',
        quantity: 1,
        turnsRemaining: 3,
        isWait: true,
      };

      state.lanes.building.active = waitItem;

      // Turn 1
      progressActive(state, 'building');
      expect(state.lanes.building.active?.turnsRemaining).toBe(2);

      // Turn 2
      progressActive(state, 'building');
      expect(state.lanes.building.active?.turnsRemaining).toBe(1);
    });

    it('should complete wait item when turnsRemaining reaches 0', () => {
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'active',
        quantity: 1,
        turnsRemaining: 1,
        isWait: true,
        startTurn: 10,
      };

      state.lanes.building.active = waitItem;
      state.currentTurn = 11;

      const completed = progressActive(state, 'building');

      expect(completed).toBeDefined();
      expect(completed?.status).toBe('completed');
      expect(completed?.completionTurn).toBe(11);
      expect(state.lanes.building.active).toBeNull();
    });

    it('should not apply any effects when wait item completes', () => {
      const initialWorkerCap = state.housing.workerCap;
      const initialGroundCap = state.space.groundCap;

      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'active',
        quantity: 1,
        turnsRemaining: 1,
        isWait: true,
      };

      state.lanes.building.active = waitItem;
      progressActive(state, 'building');

      // No effects should be applied
      expect(state.housing.workerCap).toBe(initialWorkerCap);
      expect(state.space.groundCap).toBe(initialGroundCap);
    });

    it('should not release workers (since none were reserved)', () => {
      const initialWorkers = state.population.workersIdle;

      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'active',
        quantity: 1,
        turnsRemaining: 1,
        isWait: true,
      };

      state.lanes.building.active = waitItem;
      progressActive(state, 'building');

      // Worker count should remain unchanged
      expect(state.population.workersIdle).toBe(initialWorkers);
    });
  });

  describe('Wait Item Queue Integration', () => {
    it('should activate next item after wait completes', () => {
      // Queue wait item
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 1,
        isWait: true,
      };

      // Queue normal item after wait
      const normalItem: WorkItem = {
        id: 'item-1',
        itemId: 'metal_mine',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 5,
      };

      state.lanes.building.pendingQueue.push(waitItem, normalItem);

      // Activate wait
      tryActivateNext(state, 'building');
      expect(state.lanes.building.active?.isWait).toBe(true);

      // Complete wait
      progressActive(state, 'building');
      expect(state.lanes.building.active).toBeNull();

      // Activate normal item
      tryActivateNext(state, 'building');
      expect(state.lanes.building.active?.itemId).toBe('metal_mine');
      expect(state.lanes.building.active?.isWait).toBeUndefined();
    });

    it('should allow multiple wait items in sequence', () => {
      const wait1: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 2,
        isWait: true,
      };

      const wait2: WorkItem = {
        id: 'wait-2',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 3,
        isWait: true,
      };

      state.lanes.building.pendingQueue.push(wait1, wait2);

      // Activate first wait
      tryActivateNext(state, 'building');
      expect(state.lanes.building.active?.id).toBe('wait-1');

      // Complete first wait
      progressActive(state, 'building');
      progressActive(state, 'building');

      // Activate second wait
      tryActivateNext(state, 'building');
      expect(state.lanes.building.active?.id).toBe('wait-2');
      expect(state.lanes.building.active?.turnsRemaining).toBe(3);
    });

    it('should handle wait items in all lanes independently', () => {
      const lanes: LaneId[] = ['building', 'ship', 'colonist', 'research'];

      lanes.forEach((laneId, index) => {
        const waitItem: WorkItem = {
          id: `wait-${index}`,
          itemId: '__wait__',
          status: 'pending',
          quantity: 1,
          turnsRemaining: index + 1,
          isWait: true,
        };

        state.lanes[laneId].pendingQueue.push(waitItem);
        tryActivateNext(state, laneId);

        expect(state.lanes[laneId].active?.isWait).toBe(true);
        expect(state.lanes[laneId].active?.turnsRemaining).toBe(index + 1);
      });
    });
  });

  describe('Wait Item Edge Cases', () => {
    it('should handle wait duration of 0 turns', () => {
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'active',
        quantity: 1,
        turnsRemaining: 0,
        isWait: true,
      };

      state.lanes.building.active = waitItem;

      // Should complete immediately
      const completed = progressActive(state, 'building');
      expect(completed).toBeDefined();
      expect(state.lanes.building.active).toBeNull();
    });

    it('should handle very long wait durations', () => {
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 1000,
        isWait: true,
      };

      state.lanes.building.pendingQueue.push(waitItem);
      tryActivateNext(state, 'building');

      expect(state.lanes.building.active?.turnsRemaining).toBe(1000);
    });

    it('should maintain wait item in completion history', () => {
      const waitItem: WorkItem = {
        id: 'wait-1',
        itemId: '__wait__',
        status: 'active',
        quantity: 1,
        turnsRemaining: 1,
        isWait: true,
      };

      state.lanes.building.active = waitItem;
      progressActive(state, 'building');

      expect(state.lanes.building.completionHistory).toHaveLength(1);
      expect(state.lanes.building.completionHistory[0].isWait).toBe(true);
    });
  });
});
